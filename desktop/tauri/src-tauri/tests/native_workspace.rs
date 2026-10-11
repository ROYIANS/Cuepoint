mod support;
use cuepoint_native_storage::{
    AssetKind, Availability, Hooks, Job, Outcome, Project, StorageWorker, TimingRef,
};
use std::fs;
use support::{Fixture, request, state};

fn project(worker: &StorageWorker, id: &str) {
    worker
        .run(Job::SaveProject(Project {
            id: id.into(),
            title: "测试项目".into(),
        }))
        .unwrap();
}

#[cfg(feature = "test-hooks")]
fn eventually(mut predicate: impl FnMut() -> bool) {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
    while !predicate() {
        assert!(
            std::time::Instant::now() < deadline,
            "Timed out waiting for native handshake"
        );
        std::thread::sleep(std::time::Duration::from_millis(2));
    }
}

#[test]
fn persistent_owned_media_output_studio_timing_and_source_independence() {
    let fixture = Fixture::new();
    let source = fixture.source();
    let original = fs::read(&source).unwrap();
    let worker = StorageWorker::create(fixture.path("workspace"), Hooks::default()).unwrap();
    project(&worker, "项目");
    let mut input = request(source.clone(), "take-A", "项目");
    input.timing = Some(TimingRef {
        id: "clip".into(),
        project_id: "项目".into(),
        asset_id: "take-A".into(),
        start_sec: 1.25,
        duration_sec: 3.0,
    });
    worker.run(Job::Import(input)).unwrap();
    let mut output = request(source.clone(), "take-a", "项目");
    output.kind = AssetKind::Output;
    worker.run(Job::Import(output)).unwrap();
    worker
        .run(Job::Import(request(source.clone(), "声音", "studio")))
        .unwrap();
    let before = state(&worker);
    fs::write(&source, b"changed").unwrap();
    fs::remove_file(&source).unwrap();
    for asset in &before.assets {
        assert_eq!(
            fs::read(
                fixture
                    .path("workspace")
                    .join(&asset.reference.relative_path)
            )
            .unwrap(),
            original
        );
    }
    worker.close().unwrap();
    let reopened = StorageWorker::open(fixture.path("workspace"), Hooks::default()).unwrap();
    assert_eq!(state(&reopened), before);
    assert_eq!(before.references[0].start_sec, 1.25);
    assert_eq!(before.assets.len(), 3);
    reopened.close().unwrap();
}

#[test]
fn missing_and_corrupt_keep_exact_logical_state() {
    let f = Fixture::new();
    let source = f.source();
    let w = StorageWorker::create(f.path("workspace"), Hooks::default()).unwrap();
    project(&w, "project");
    w.run(Job::Import(request(source.clone(), "missing", "project")))
        .unwrap();
    w.run(Job::Import(request(source, "corrupt", "project")))
        .unwrap();
    let before = state(&w);
    for a in &before.assets {
        if a.id == "missing" {
            fs::remove_file(f.path("workspace").join(&a.reference.relative_path)).unwrap();
        } else {
            fs::write(f.path("workspace").join(&a.reference.relative_path), b"bad").unwrap();
        }
    }
    match w.run(Job::Availability).unwrap() {
        Outcome::Availability(items) => {
            assert_eq!(items[0].status, Availability::Corrupt);
            assert_eq!(items[1].status, Availability::Missing);
        }
        _ => panic!("availability"),
    }
    assert_eq!(state(&w), before);
    assert!(w.run(Job::Backup(f.path("backup"))).is_err());
    w.close().unwrap();
    let reopened = StorageWorker::open(f.path("workspace"), Hooks::default()).unwrap();
    assert_eq!(state(&reopened), before);
    reopened.close().unwrap();
}

#[test]
fn real_writer_contention_and_new_root_no_overwrite() {
    let f = Fixture::new();
    let w = StorageWorker::create(f.path("workspace"), Hooks::default()).unwrap();
    assert!(StorageWorker::open(f.path("workspace"), Hooks::default()).is_err());
    assert!(StorageWorker::create(f.path("workspace"), Hooks::default()).is_err());
    fs::create_dir(f.path("empty")).unwrap();
    assert!(StorageWorker::create(f.path("empty"), Hooks::default()).is_err());
    w.close().unwrap();
    let w2 = StorageWorker::open(f.path("workspace"), Hooks::default()).unwrap();
    w2.close().unwrap();
}

#[test]
fn snapshot_backup_restore_exact_and_strict_corruption() {
    let f = Fixture::new();
    let source = f.source();
    let w = StorageWorker::create(f.path("workspace"), Hooks::default()).unwrap();
    project(&w, "project");
    w.run(Job::Import(request(source, "asset", "project")))
        .unwrap();
    let before = state(&w);
    w.run(Job::Backup(f.path("backup"))).unwrap();
    assert!(!f.path("backup/writer.sqlite").exists());
    let restored =
        StorageWorker::restore(f.path("backup"), f.path("restored"), Hooks::default()).unwrap();
    assert_eq!(state(&restored), before);
    restored.close().unwrap();
    fs::create_dir(f.path("empty")).unwrap();
    assert!(StorageWorker::restore(f.path("backup"), f.path("empty"), Hooks::default()).is_err());
    assert!(fs::read_dir(f.path("empty")).unwrap().next().is_none());
    fs::create_dir(f.path("populated")).unwrap();
    fs::write(f.path("populated/keep"), b"existing bytes").unwrap();
    assert!(
        StorageWorker::restore(f.path("backup"), f.path("populated"), Hooks::default()).is_err()
    );
    assert_eq!(
        fs::read(f.path("populated/keep")).unwrap(),
        b"existing bytes"
    );
    assert!(w.run(Job::Backup(f.path("empty"))).is_err());
    assert!(fs::read_dir(f.path("empty")).unwrap().next().is_none());
    let manifest_path = f.path("backup/backup.complete.json");
    let original = fs::read(&manifest_path).unwrap();
    let mut value: serde_json::Value = serde_json::from_slice(&original).unwrap();
    value["credentials"] = serde_json::json!("forbidden");
    fs::write(&manifest_path, serde_json::to_vec(&value).unwrap()).unwrap();
    assert!(
        StorageWorker::restore(f.path("backup"), f.path("bad-extra"), Hooks::default()).is_err()
    );
    fs::write(&manifest_path, &original).unwrap();
    value = serde_json::from_slice(&original).unwrap();
    value["assets"][0]["reference"]["relativePath"] = serde_json::json!("../source.bin");
    fs::write(&manifest_path, serde_json::to_vec(&value).unwrap()).unwrap();
    assert!(
        StorageWorker::restore(f.path("backup"), f.path("bad-path"), Hooks::default()).is_err()
    );
    fs::write(&manifest_path, &original).unwrap();
    value = serde_json::from_slice(&original).unwrap();
    let asset = value["assets"][0].clone();
    value["assets"].as_array_mut().unwrap().push(asset);
    fs::write(&manifest_path, serde_json::to_vec(&value).unwrap()).unwrap();
    assert!(
        StorageWorker::restore(f.path("backup"), f.path("bad-duplicate"), Hooks::default())
            .is_err()
    );
    fs::write(&manifest_path, &original).unwrap();
    value = serde_json::from_slice(&original).unwrap();
    value["workspaceId"] = serde_json::json!(uuid::Uuid::new_v4().to_string());
    fs::write(&manifest_path, serde_json::to_vec(&value).unwrap()).unwrap();
    assert!(
        StorageWorker::restore(f.path("backup"), f.path("bad-workspace"), Hooks::default())
            .is_err()
    );
    fs::write(&manifest_path, &original).unwrap();
    fs::write(
        f.path("backup")
            .join(&before.assets[0].reference.relative_path),
        b"truncated",
    )
    .unwrap();
    assert!(
        StorageWorker::restore(f.path("backup"), f.path("bad-bytes"), Hooks::default()).is_err()
    );
    w.close().unwrap();
}

#[test]
fn schema_identity_owner_and_incomplete_roots_reject() {
    let f = Fixture::new();
    let w = StorageWorker::create(f.path("workspace"), Hooks::default()).unwrap();
    w.close().unwrap();
    let db = rusqlite::Connection::open(f.path("workspace/metadata.sqlite")).unwrap();
    db.pragma_update(None, "user_version", 2).unwrap();
    drop(db);
    assert!(StorageWorker::open(f.path("workspace"), Hooks::default()).is_err());
    let w = StorageWorker::create(f.path("other"), Hooks::default()).unwrap();
    assert!(
        w.run(Job::Import(request(f.source(), "a", "missing")))
            .is_err()
    );
    w.close().unwrap();
    fs::remove_file(f.path("other/workspace.ready.json")).unwrap();
    assert!(StorageWorker::open(f.path("other"), Hooks::default()).is_err());
    let db = rusqlite::Connection::open(f.path("workspace/metadata.sqlite")).unwrap();
    db.pragma_update(None, "user_version", 1).unwrap();
    db.execute("UPDATE workspace SET id='browser-local'", [])
        .unwrap();
    drop(db);
    assert!(StorageWorker::open(f.path("workspace"), Hooks::default()).is_err());
}

#[cfg(unix)]
#[test]
fn symlink_hardlink_target_and_ancestor_boundaries_preserve_external_bytes() {
    use std::os::unix::fs::symlink;
    let f = Fixture::new();
    let source = f.source();
    let original = fs::read(&source).unwrap();
    let w = StorageWorker::create(f.path("workspace"), Hooks::default()).unwrap();
    project(&w, "project");
    symlink(&source, f.path("alias-source")).unwrap();
    assert!(
        w.run(Job::Import(request(f.path("alias-source"), "a", "project")))
            .is_err()
    );
    fs::hard_link(&source, f.path("hard-source")).unwrap();
    assert!(
        w.run(Job::Import(request(source.clone(), "a", "project")))
            .is_err()
    );
    fs::remove_file(f.path("hard-source")).unwrap();
    symlink(&f.base, f.path("workspace/projects")).unwrap();
    assert!(
        w.run(Job::Import(request(source.clone(), "a", "project")))
            .is_err()
    );
    fs::remove_file(f.path("workspace/projects")).unwrap();
    w.close().unwrap();
    symlink(f.path("workspace"), f.path("root-alias")).unwrap();
    assert!(StorageWorker::open(f.path("root-alias"), Hooks::default()).is_err());
    fs::hard_link(
        f.path("workspace/metadata.sqlite"),
        f.path("database-alias"),
    )
    .unwrap();
    assert!(StorageWorker::open(f.path("workspace"), Hooks::default()).is_err());
    assert_eq!(fs::read(source).unwrap(), original);
}

#[cfg(feature = "test-hooks")]
#[test]
fn cancellation_is_independent_queued_inputs_frozen_and_commit_wins_late_abort() {
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };
    let f = Fixture::new();
    let reached = Arc::new(AtomicBool::new(false));
    let release = Arc::new(AtomicBool::new(false));
    let flag = Arc::clone(&reached);
    let gate = Arc::clone(&release);
    let hooks = Hooks::new(move |point| {
        if point == "partial-copy" {
            flag.store(true, Ordering::SeqCst);
            eventually(|| gate.load(Ordering::SeqCst));
        }
        Ok(())
    });
    let w = StorageWorker::create(f.path("workspace"), hooks).unwrap();
    project(&w, "project");
    let operation = w
        .submit(Job::Import(request(f.source(), "canceled", "project")))
        .unwrap();
    let mut draft = Project {
        id: "queued".into(),
        title: "original".into(),
    };
    let queued = w.submit(Job::SaveProject(draft.clone())).unwrap();
    draft.title = "mutated".into();
    eventually(|| reached.load(Ordering::SeqCst));
    assert!(w.cancel(&operation.id).unwrap());
    release.store(true, Ordering::SeqCst);
    assert_eq!(operation.wait().unwrap_err().code, "canceled");
    queued.wait().unwrap();
    assert_eq!(
        state(&w)
            .projects
            .iter()
            .find(|p| p.id == "queued")
            .unwrap()
            .title,
        "original"
    );
    assert!(state(&w).assets.is_empty());
    w.close().unwrap();
    let reached = Arc::new(AtomicBool::new(false));
    let release = Arc::new(AtomicBool::new(false));
    let flag = Arc::clone(&reached);
    let gate = Arc::clone(&release);
    let hooks = Hooks::new(move |point| {
        if point == "postcommit" {
            flag.store(true, Ordering::SeqCst);
            eventually(|| gate.load(Ordering::SeqCst));
        }
        Ok(())
    });
    let w = StorageWorker::open(f.path("workspace"), hooks).unwrap();
    let operation = w
        .submit(Job::Import(request(f.source(), "committed", "project")))
        .unwrap();
    eventually(|| reached.load(Ordering::SeqCst));
    assert!(w.cancel(&operation.id).unwrap());
    release.store(true, Ordering::SeqCst);
    assert!(matches!(operation.wait().unwrap(), Outcome::Asset(_)));
    assert_eq!(state(&w).assets.len(), 1);
    w.close().unwrap();
}

#[cfg(feature = "test-hooks")]
#[test]
fn source_change_injected_io_error_and_precommit_abort_leave_no_ready_asset() {
    use std::sync::atomic::{AtomicBool, Ordering};
    let f = Fixture::new();
    let source = f.source();
    let changed = source.clone();
    let once = AtomicBool::new(false);
    let hooks = Hooks::new(move |point| {
        if point == "partial-copy" && !once.swap(true, Ordering::SeqCst) {
            fs::write(&changed, b"changed")?;
        }
        Ok(())
    });
    let w = StorageWorker::create(f.path("workspace"), hooks).unwrap();
    project(&w, "project");
    assert_eq!(
        w.run(Job::Import(request(source, "changed", "project")))
            .unwrap_err()
            .code,
        "changed"
    );
    assert!(state(&w).assets.is_empty());
    w.close().unwrap();
    for point in ["copy-chunk", "precommit"] {
        let hooks = Hooks::new(move |p| {
            if p == point {
                return Err(cuepoint_native_storage::Error {
                    code: "injected",
                    message: "Deterministic failure".into(),
                });
            }
            Ok(())
        });
        let w = StorageWorker::open(f.path("workspace"), hooks).unwrap();
        assert_eq!(
            w.run(Job::Import(request(f.source(), point, "project")))
                .unwrap_err()
                .code,
            "injected"
        );
        assert!(state(&w).assets.is_empty());
        w.close().unwrap();
    }
}

#[cfg(feature = "test-hooks")]
#[test]
fn queued_backup_excludes_later_writes_and_lifecycle_close_cancels_before_commit() {
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };
    let f = Fixture::new();
    let reached = Arc::new(AtomicBool::new(false));
    let release = Arc::new(AtomicBool::new(false));
    let flag = Arc::clone(&reached);
    let gate = Arc::clone(&release);
    let hooks = Hooks::new(move |p| {
        if p == "backup-before-completion" {
            flag.store(true, Ordering::SeqCst);
            eventually(|| gate.load(Ordering::SeqCst));
        }
        Ok(())
    });
    let w = StorageWorker::create(f.path("workspace"), hooks).unwrap();
    project(&w, "original");
    let before = state(&w);
    let backup = w.submit(Job::Backup(f.path("backup"))).unwrap();
    eventually(|| reached.load(Ordering::SeqCst));
    let later = w
        .submit(Job::SaveProject(Project {
            id: "later".into(),
            title: "Queued later".into(),
        }))
        .unwrap();
    release.store(true, Ordering::SeqCst);
    backup.wait().unwrap();
    later.wait().unwrap();
    let restored =
        StorageWorker::restore(f.path("backup"), f.path("restore"), Hooks::default()).unwrap();
    assert_eq!(state(&restored), before);
    restored.close().unwrap();
    assert_eq!(state(&w).projects.len(), 2);
    w.close().unwrap();
    let reached = Arc::new(AtomicBool::new(false));
    let release = Arc::new(AtomicBool::new(false));
    let flag = Arc::clone(&reached);
    let gate = Arc::clone(&release);
    let hooks = Hooks::new(move |p| {
        if p == "precommit" {
            flag.store(true, Ordering::SeqCst);
            eventually(|| gate.load(Ordering::SeqCst));
        }
        Ok(())
    });
    let w = StorageWorker::open(f.path("workspace"), hooks).unwrap();
    let import = w
        .submit(Job::Import(request(f.source(), "closed", "original")))
        .unwrap();
    eventually(|| reached.load(Ordering::SeqCst));
    let closer = w.clone();
    let close = std::thread::spawn(move || closer.close());
    eventually(|| w.submit(Job::State).is_err());
    release.store(true, Ordering::SeqCst);
    assert_eq!(import.wait().unwrap_err().code, "closed");
    close.join().unwrap().unwrap();
    let reopened = StorageWorker::open(f.path("workspace"), Hooks::default()).unwrap();
    assert!(state(&reopened).assets.is_empty());
    reopened.close().unwrap();
}

#[cfg(feature = "test-hooks")]
#[test]
fn owner_is_rechecked_at_real_commit_and_fresh_publication_never_overwrites() {
    let f = Fixture::new();
    let root = f.path("workspace");
    let db_path = root.join("metadata.sqlite");
    let hooks = Hooks::new(move |p| {
        if p == "published" {
            let db = rusqlite::Connection::open(&db_path)?;
            db.execute("DELETE FROM projects WHERE id='project'", [])?;
        }
        Ok(())
    });
    let w = StorageWorker::create(&root, hooks).unwrap();
    project(&w, "project");
    let source = f.source();
    assert_eq!(
        w.run(Job::Import(request(source.clone(), "asset", "project")))
            .unwrap_err()
            .code,
        "ownership"
    );
    assert!(state(&w).assets.is_empty());
    w.close().unwrap();
    let w = StorageWorker::open(&root, Hooks::default()).unwrap();
    project(&w, "project");
    let reference =
        cuepoint_native_storage::derive_ref(&state(&w).workspace_id, "project", "asset").unwrap();
    let target = root.join(reference.relative_path);
    fs::create_dir_all(target.parent().unwrap()).unwrap();
    fs::write(&target, b"keep existing").unwrap();
    assert_eq!(
        w.run(Job::Import(request(source, "asset", "project")))
            .unwrap_err()
            .code,
        "duplicate"
    );
    assert_eq!(fs::read(target).unwrap(), b"keep existing");
    w.close().unwrap();
}

#[cfg(feature = "test-hooks")]
#[test]
fn managed_bytes_changed_during_stage_or_actual_commit_are_not_ready() {
    for point in ["before-publication", "published", "precommit"] {
        let f = Fixture::new();
        let root = f.path("workspace");
        let altered_root = root.clone();
        let hooks = Hooks::new(move |p| {
            if p == point {
                let db = rusqlite::Connection::open(altered_root.join("metadata.sqlite"))?;
                let field = if point == "before-publication" {
                    "stage"
                } else {
                    "final_path"
                };
                let relative: String =
                    db.query_row(&format!("SELECT {field} FROM intents"), [], |r| r.get(0))?;
                fs::write(altered_root.join(relative), b"tampered")?;
            }
            Ok(())
        });
        let w = StorageWorker::create(&root, hooks).unwrap();
        project(&w, "project");
        assert!(
            w.run(Job::Import(request(f.source(), "asset", "project")))
                .is_err()
        );
        assert!(state(&w).assets.is_empty());
        w.close().unwrap();
    }
}

#[cfg(feature = "test-hooks")]
struct ChildGuard(std::process::Child);
#[cfg(feature = "test-hooks")]
impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
#[cfg(feature = "test-hooks")]
fn child(f: &Fixture, mode: &str, root: &str, point: Option<&str>) -> ChildGuard {
    use std::process::{Command, Stdio};
    let mut command = Command::new(env!("CARGO_BIN_EXE_workspace_probe"));
    command.arg(mode).arg(f.path(root));
    if mode == "restore" {
        command.arg(f.path("backup"));
    }
    if let Some(point) = point {
        command
            .args(["--pause", point, "--marker"])
            .arg(f.path("marker"))
            .arg("--release")
            .arg(f.path("release"));
    }
    ChildGuard(
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .unwrap(),
    )
}
#[cfg(feature = "test-hooks")]
fn send(child: &mut ChildGuard, value: serde_json::Value) {
    use std::io::Write;
    let stdin = child.0.stdin.as_mut().unwrap();
    writeln!(stdin, "{value}").unwrap();
    stdin.flush().unwrap();
}
#[cfg(feature = "test-hooks")]
fn kill(child: &mut ChildGuard) {
    child.0.kill().unwrap();
    assert!(!child.0.wait().unwrap().success());
}

#[cfg(feature = "test-hooks")]
#[test]
fn genuine_process_kills_import_recovery_is_idempotent_and_preserves_unknown_sources() {
    for point in [
        "intent-before-stage",
        "partial-copy",
        "before-publication",
        "link-before-unlink",
        "published",
        "precommit",
        "postcommit",
    ] {
        let f = Fixture::new();
        let source = f.source();
        let original = fs::read(&source).unwrap();
        let w = StorageWorker::create(f.path("workspace"), Hooks::default()).unwrap();
        project(&w, "project");
        w.close().unwrap();
        fs::create_dir(f.path("workspace/staging")).unwrap();
        fs::write(f.path("workspace/staging/unknown.keep"), b"unknown").unwrap();
        let mut process = child(&f, "open", "workspace", Some(point));
        send(
            &mut process,
            serde_json::json!({"op":"import","source":source,"asset_id":"asset","project_id":"project","kind":"media","display_name":"same.bin","mime_type":"application/octet-stream","timing":null}),
        );
        eventually(|| f.path("marker").exists());
        kill(&mut process);
        let reopened = StorageWorker::open(f.path("workspace"), Hooks::default()).unwrap();
        let first = state(&reopened);
        assert_eq!(first.assets.len(), usize::from(point == "postcommit"));
        reopened.close().unwrap();
        let twice = StorageWorker::open(f.path("workspace"), Hooks::default()).unwrap();
        assert_eq!(state(&twice), first);
        twice.close().unwrap();
        assert_eq!(fs::read(&source).unwrap(), original);
        assert_eq!(
            fs::read(f.path("workspace/staging/unknown.keep")).unwrap(),
            b"unknown"
        );
        let db = rusqlite::Connection::open(f.path("workspace/metadata.sqlite")).unwrap();
        assert_eq!(
            db.query_row("SELECT count(*) FROM intents", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
}

#[cfg(feature = "test-hooks")]
#[test]
fn genuine_backup_and_restore_process_kills_follow_completion_authority() {
    for point in ["backup-before-completion", "backup-after-completion"] {
        let f = Fixture::new();
        let w = StorageWorker::create(f.path("workspace"), Hooks::default()).unwrap();
        project(&w, "project");
        w.run(Job::Import(request(f.source(), "asset", "project")))
            .unwrap();
        let before = state(&w);
        w.close().unwrap();
        let mut process = child(&f, "open", "workspace", Some(point));
        send(
            &mut process,
            serde_json::json!({"op":"backup","destination":f.path("backup")}),
        );
        eventually(|| f.path("marker").exists());
        kill(&mut process);
        let restored =
            StorageWorker::restore(f.path("backup"), f.path("restore"), Hooks::default());
        if point == "backup-after-completion" {
            let restored = restored.unwrap();
            assert_eq!(state(&restored), before);
            restored.close().unwrap();
        } else {
            assert!(restored.is_err());
        }
    }
    for point in ["restore-before-completion", "restore-after-completion"] {
        let f = Fixture::new();
        let w = StorageWorker::create(f.path("workspace"), Hooks::default()).unwrap();
        project(&w, "project");
        w.run(Job::Import(request(f.source(), "asset", "project")))
            .unwrap();
        let before = state(&w);
        w.run(Job::Backup(f.path("backup"))).unwrap();
        w.close().unwrap();
        let mut process = child(&f, "restore", "restore", Some(point));
        eventually(|| f.path("marker").exists());
        kill(&mut process);
        let restored = StorageWorker::open(f.path("restore"), Hooks::default());
        if point == "restore-after-completion" {
            let restored = restored.unwrap();
            assert_eq!(state(&restored), before);
            restored.close().unwrap();
        } else {
            assert!(restored.is_err());
            assert!(StorageWorker::create(f.path("restore"), Hooks::default()).is_err());
        }
    }
}

#[cfg(feature = "test-hooks")]
#[test]
fn live_second_process_refuses_and_actual_death_releases_writer() {
    use std::io::BufRead;
    let f = Fixture::new();
    let w = StorageWorker::create(f.path("workspace"), Hooks::default()).unwrap();
    let before = state(&w);
    w.close().unwrap();
    let mut process = child(&f, "open", "workspace", None);
    let mut line = String::new();
    std::io::BufReader::new(process.0.stdout.take().unwrap())
        .read_line(&mut line)
        .unwrap();
    assert!(line.contains("ready"));
    assert!(StorageWorker::open(f.path("workspace"), Hooks::default()).is_err());
    kill(&mut process);
    let w = StorageWorker::open(f.path("workspace"), Hooks::default()).unwrap();
    assert_eq!(state(&w), before);
    w.close().unwrap();
}

#[cfg(feature = "test-hooks")]
#[test]
fn lifecycle_close_after_actual_commit_reports_committed_asset() {
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };
    let f = Fixture::new();
    let reached = Arc::new(AtomicBool::new(false));
    let release = Arc::new(AtomicBool::new(false));
    let flag = Arc::clone(&reached);
    let gate = Arc::clone(&release);
    let hooks = Hooks::new(move |p| {
        if p == "postcommit" {
            flag.store(true, Ordering::SeqCst);
            eventually(|| gate.load(Ordering::SeqCst));
        }
        Ok(())
    });
    let w = StorageWorker::create(f.path("workspace"), hooks).unwrap();
    project(&w, "project");
    let import = w
        .submit(Job::Import(request(f.source(), "committed", "project")))
        .unwrap();
    eventually(|| reached.load(Ordering::SeqCst));
    let closer = w.clone();
    let close = std::thread::spawn(move || closer.close());
    eventually(|| w.submit(Job::State).is_err());
    release.store(true, Ordering::SeqCst);
    assert!(matches!(import.wait().unwrap(), Outcome::Asset(_)));
    close.join().unwrap().unwrap();
    let reopened = StorageWorker::open(f.path("workspace"), Hooks::default()).unwrap();
    assert_eq!(state(&reopened).assets.len(), 1);
    reopened.close().unwrap();
}

#[cfg(feature = "test-hooks")]
#[test]
fn canceled_backup_has_no_completion_and_successful_publication_wins_late_cancel() {
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };
    for point in ["backup-before-completion", "backup-after-completion"] {
        let f = Fixture::new();
        let reached = Arc::new(AtomicBool::new(false));
        let release = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&reached);
        let gate = Arc::clone(&release);
        let hooks = Hooks::new(move |p| {
            if p == point {
                flag.store(true, Ordering::SeqCst);
                eventually(|| gate.load(Ordering::SeqCst));
            }
            Ok(())
        });
        let w = StorageWorker::create(f.path("workspace"), hooks).unwrap();
        project(&w, "project");
        w.run(Job::Import(request(f.source(), "asset", "project")))
            .unwrap();
        let operation = w.submit(Job::Backup(f.path("backup"))).unwrap();
        eventually(|| reached.load(Ordering::SeqCst));
        assert!(w.cancel(&operation.id).unwrap());
        release.store(true, Ordering::SeqCst);
        let result = operation.wait();
        if point == "backup-before-completion" {
            assert_eq!(result.unwrap_err().code, "canceled");
            assert!(!f.path("backup/backup.complete.json").exists());
        } else {
            assert!(matches!(result.unwrap(), Outcome::Backup(_)));
            let restored =
                StorageWorker::restore(f.path("backup"), f.path("restore"), Hooks::default())
                    .unwrap();
            assert_eq!(state(&restored), state(&w));
            restored.close().unwrap();
        }
        w.close().unwrap();
    }
}

#[cfg(feature = "test-hooks")]
#[test]
fn owner_removed_before_publication_rejects_at_actual_metadata_boundary() {
    let f = Fixture::new();
    let root = f.path("workspace");
    let db_path = root.join("metadata.sqlite");
    let hooks = Hooks::new(move |p| {
        if p == "before-publication" {
            let db = rusqlite::Connection::open(&db_path)?;
            db.execute("DELETE FROM projects WHERE id='project'", [])?;
        }
        Ok(())
    });
    let w = StorageWorker::create(root, hooks).unwrap();
    project(&w, "project");
    assert_eq!(
        w.run(Job::Import(request(f.source(), "asset", "project")))
            .unwrap_err()
            .code,
        "ownership"
    );
    assert!(state(&w).assets.is_empty());
    w.close().unwrap();
}

#[cfg(all(feature = "test-hooks", unix))]
#[test]
fn recovery_refuses_external_inode_alias_and_foreign_intent_paths_without_deletion() {
    for attack in ["alias", "foreign"] {
        let f = Fixture::new();
        let source = f.source();
        let w = StorageWorker::create(f.path("workspace"), Hooks::default()).unwrap();
        project(&w, "project");
        w.close().unwrap();
        let mut process = child(&f, "open", "workspace", Some("link-before-unlink"));
        send(
            &mut process,
            serde_json::json!({"op":"import","source":source,"asset_id":"asset","project_id":"project","kind":"media","display_name":"same.bin","mime_type":"application/octet-stream","timing":null}),
        );
        eventually(|| f.path("marker").exists());
        kill(&mut process);
        let db = rusqlite::Connection::open(f.path("workspace/metadata.sqlite")).unwrap();
        let stage: String = db
            .query_row("SELECT stage FROM intents", [], |r| r.get(0))
            .unwrap();
        if attack == "alias" {
            fs::hard_link(f.path("workspace").join(&stage), f.path("external-alias")).unwrap();
        } else {
            db.execute("UPDATE intents SET final_path='../source.bin'", [])
                .unwrap();
        }
        drop(db);
        assert!(StorageWorker::open(f.path("workspace"), Hooks::default()).is_err());
        assert!(f.path("workspace").join(&stage).is_file());
        assert!(source.is_file());
        if attack == "alias" {
            fs::remove_file(f.path("external-alias")).unwrap();
            let w = StorageWorker::open(f.path("workspace"), Hooks::default()).unwrap();
            assert!(state(&w).assets.is_empty());
            w.close().unwrap();
        }
    }
}
