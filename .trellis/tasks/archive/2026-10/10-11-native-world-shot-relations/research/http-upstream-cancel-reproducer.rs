// Regression uses actual reqwest body + Tauri ResourceTable, not a mocked future.
use super::*;
use std::io::{Read, Write};

fn stalled_response() -> (String, std::sync::mpsc::Receiver<bool>, std::thread::JoinHandle<()>) {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/stalled-body", listener.local_addr().unwrap());
    let (tx, rx) = std::sync::mpsc::channel();
    let server = std::thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        let mut request = [0; 4096]; socket.read(&mut request).unwrap();
        socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n5\r\nfirst\r\n").unwrap();
        socket.flush().unwrap();
        let disconnected = matches!(socket.read(&mut request), Ok(0));
        tx.send(disconnected).unwrap();
    });
    (url, rx, server)
}

#[test]
fn pending_body_resource_close_does_not_disconnect_upstream() {
    tauri::async_runtime::block_on(async {
        let (url, disconnected, server) = stalled_response();
        let mut response = reqwest::Client::builder().no_proxy().build().unwrap().get(url).send().await.unwrap();
        assert_eq!(response.chunk().await.unwrap().unwrap().as_ref(), b"first");
        let mut table = ResourceTable::default();
        let rid = table.add(ReqwestResponse(response));
        let resource = table.get::<ReqwestResponse>(rid).unwrap();
        let (ready_tx, ready_rx) = channel();
        let task = tauri::async_runtime::spawn(async move {
            let ptr = Arc::as_ptr(&resource) as *mut ReqwestResponse;
            let response = unsafe { &mut *ptr };
            let _ = ready_tx.send(());
            response.0.chunk().await
        });
        ready_rx.await.unwrap();
        std::thread::sleep(Duration::from_millis(30));
        table.close(rid).unwrap();
        // Current upstream pending read retains its Arc; closing the resource does not cancel it.
        assert!(disconnected.recv_timeout(Duration::from_millis(300)).is_err());
        task.abort();
        assert!(disconnected.recv_timeout(Duration::from_secs(2)).unwrap());
        server.join().unwrap();
    });
}
