use crate::{Error, Hooks, Job, Outcome, Result, workspace::Workspace};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
        mpsc,
    },
    thread::{self, JoinHandle},
};

type Reply = mpsc::Sender<Result<Outcome>>;
enum Message {
    Run {
        id: String,
        job: Box<Job>,
        cancel: Arc<AtomicBool>,
        reply: Reply,
    },
    Close(mpsc::Sender<Result<()>>),
}
enum StartMode {
    Create,
    Open,
    Restore(PathBuf),
}
struct Shared {
    tx: mpsc::Sender<Message>,
    closed: Arc<AtomicBool>,
    operations: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    thread: Mutex<Option<JoinHandle<()>>>,
    close: Mutex<()>,
}
/// A single dedicated SQLite/file owner. Inputs are moved into the queue, not borrowed.
#[derive(Clone)]
pub struct StorageWorker {
    shared: Arc<Shared>,
}
pub struct Operation {
    pub id: String,
    receiver: mpsc::Receiver<Result<Outcome>>,
}
impl Operation {
    pub fn wait(self) -> Result<Outcome> {
        self.receiver
            .recv()
            .map_err(|_| Error::new("closed", "Storage worker ended"))?
    }
}

impl StorageWorker {
    pub fn create(root: impl AsRef<Path>, hooks: Hooks) -> Result<Self> {
        Self::start(root.as_ref().to_owned(), StartMode::Create, hooks)
    }
    pub fn open(root: impl AsRef<Path>, hooks: Hooks) -> Result<Self> {
        Self::start(root.as_ref().to_owned(), StartMode::Open, hooks)
    }
    pub fn restore(
        backup: impl AsRef<Path>,
        destination: impl AsRef<Path>,
        hooks: Hooks,
    ) -> Result<Self> {
        Self::start(
            destination.as_ref().to_owned(),
            StartMode::Restore(backup.as_ref().to_owned()),
            hooks,
        )
    }
    fn start(root: PathBuf, mode: StartMode, hooks: Hooks) -> Result<Self> {
        let (tx, rx) = mpsc::channel();
        let (ready_tx, ready_rx) = mpsc::channel();
        let closed = Arc::new(AtomicBool::new(false));
        let operations = Arc::new(Mutex::new(HashMap::new()));
        let worker_closed = Arc::clone(&closed);
        let worker_ops = Arc::clone(&operations);
        let thread = thread::Builder::new()
            .name("cuepoint-storage".into())
            .spawn(move || {
                let initialized = match mode {
                    StartMode::Create => Workspace::open(root, true, hooks),
                    StartMode::Open => Workspace::open(root, false, hooks),
                    StartMode::Restore(backup) => crate::backup::restore(&backup, &root, &hooks)
                        .and_then(|restored| Workspace::open(restored, false, hooks)),
                };
                let mut workspace = match initialized {
                    Ok(w) => {
                        let _ = ready_tx.send(Ok(()));
                        w
                    }
                    Err(e) => {
                        let _ = ready_tx.send(Err(e));
                        return;
                    }
                };
                while let Ok(message) = rx.recv() {
                    match message {
                        Message::Run {
                            id,
                            job,
                            cancel,
                            reply,
                        } => {
                            let check = || {
                                if worker_closed.load(Ordering::SeqCst) {
                                    return Err(Error::new("closed", "Workspace lifecycle ended"));
                                }
                                if cancel.load(Ordering::SeqCst) {
                                    return Err(Error::new("canceled", "Operation canceled"));
                                }
                                Ok(())
                            };
                            let result = check().and_then(|()| workspace.run(*job, check));
                            if let Ok(mut ops) = worker_ops.lock() {
                                ops.remove(&id);
                            }
                            let _ = reply.send(result);
                        }
                        Message::Close(reply) => {
                            let result = workspace.close();
                            let _ = reply.send(result);
                            break;
                        }
                    }
                }
            })?;
        if let Err(e) = ready_rx
            .recv()
            .map_err(|_| Error::new("closed", "Worker initialization ended"))?
        {
            let _ = thread.join();
            return Err(e);
        }
        Ok(Self {
            shared: Arc::new(Shared {
                tx,
                closed,
                operations,
                thread: Mutex::new(Some(thread)),
                close: Mutex::new(()),
            }),
        })
    }
    pub fn submit(&self, job: Job) -> Result<Operation> {
        // The registry is also the admission lock: Close cannot be queued between
        // a lifecycle check and its Run message, leaving an unexecuted live entry.
        let mut operations = self
            .shared
            .operations
            .lock()
            .map_err(|_| Error::new("worker", "Cancel registry poisoned"))?;
        if self.shared.closed.load(Ordering::SeqCst) {
            return Err(Error::new("closed", "Workspace is closed"));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let cancel = Arc::new(AtomicBool::new(false));
        let (reply, receiver) = mpsc::channel();
        operations.insert(id.clone(), Arc::clone(&cancel));
        if self
            .shared
            .tx
            .send(Message::Run {
                id: id.clone(),
                job: Box::new(job),
                cancel,
                reply,
            })
            .is_err()
        {
            operations.remove(&id);
            return Err(Error::new("closed", "Worker ended"));
        }
        Ok(Operation { id, receiver })
    }
    pub fn run(&self, job: Job) -> Result<Outcome> {
        self.submit(job)?.wait()
    }
    /// Signals atomically outside the storage queue, so a copying operation can observe it.
    pub fn cancel(&self, operation_id: &str) -> Result<bool> {
        let ops = self
            .shared
            .operations
            .lock()
            .map_err(|_| Error::new("worker", "Cancel registry poisoned"))?;
        if let Some(flag) = ops.get(operation_id) {
            flag.store(true, Ordering::SeqCst);
            Ok(true)
        } else {
            Ok(false)
        }
    }
    pub fn close(&self) -> Result<()> {
        // Every successful idempotent caller observes the completed close barrier.
        let _close = self
            .shared
            .close
            .lock()
            .map_err(|_| Error::new("worker", "Close barrier poisoned"))?;
        let operations = self
            .shared
            .operations
            .lock()
            .map_err(|_| Error::new("worker", "Cancel registry poisoned"))?;
        if self.shared.closed.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        let (tx, rx) = mpsc::channel();
        self.shared
            .tx
            .send(Message::Close(tx))
            .map_err(|_| Error::new("closed", "Worker ended before close"))?;
        drop(operations);
        let result = rx
            .recv()
            .map_err(|_| Error::new("closed", "Worker close ended"))?;
        if let Some(thread) = self
            .shared
            .thread
            .lock()
            .map_err(|_| Error::new("worker", "Join poisoned"))?
            .take()
        {
            thread
                .join()
                .map_err(|_| Error::new("worker", "Storage thread panicked"))?;
        }
        result
    }
}
impl Drop for Shared {
    fn drop(&mut self) {
        self.closed.store(true, Ordering::SeqCst);
        let (tx, _) = mpsc::channel();
        let _ = self.tx.send(Message::Close(tx));
        if let Ok(handle) = self.thread.get_mut()
            && let Some(thread) = handle.take()
        {
            let _ = thread.join();
        }
    }
}
