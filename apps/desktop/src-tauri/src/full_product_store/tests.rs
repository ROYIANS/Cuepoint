use super::*;
fn fixture(hooks: Hooks) -> FullProductStore {
    let root = std::env::temp_dir().join(format!("cuepoint-product-test-{}", uuid::Uuid::new_v4()));
    FullProductStore::open(root, true, hooks).unwrap()
}
fn call(store: &mut FullProductStore, kind: &str, mut dto: Value) -> Result<Value> {
    if kind != "open" {
        let token = store.token();
        for key in ["version", "session", "workspaceId", "generation"] {
            dto[key] = token[key].clone();
        }
    }
    let request: Request = serde_json::from_value(json!({"type":kind,"request":dto}))?;
    request.validate_wire()?;
    store.run(request, || Ok(()))
}
fn begin(store: &mut FullProductStore, tables: &[&str]) -> Value {
    call(
        store,
        "begin",
        json!({"operationId":uuid::Uuid::new_v4().to_string(),"mode":"rw","tables":tables}),
    )
    .unwrap()
}
fn encoded(properties: Vec<(&str, Value)>) -> Value {
    json!([
        "obj",
        properties
            .into_iter()
            .map(|(key, value)| json!([key, value]))
            .collect::<Vec<_>>()
    ])
}
fn row(id: &str, properties: Vec<(&str, Value)>) -> Value {
    let mut p = vec![("id", json!(["str", id]))];
    p.extend(properties);
    encoded(p)
}
fn finish(store: &mut FullProductStore, handle: &Value, mutations: Vec<Value>) -> Result<Value> {
    let payload = mutations
        .into_iter()
        .map(|m| serde_json::to_string(&json!({"kind":"mutation","mutation":m})).unwrap() + "\n")
        .collect::<String>();
    let mut sha = Sha256::new();
    sha.update(b"cuepoint-batch-v1\n");
    sha.update(payload.as_bytes());
    let fingerprint = paths::hex_digest(sha.finalize());
    let mut offset = 0;
    let mut chunk = 0;
    while offset < payload.len() {
        let mut end = (offset + 32768).min(payload.len());
        while !payload.is_char_boundary(end) {
            end -= 1;
        }
        let mut dto = handle.clone();
        dto["chunkIndex"] = json!(chunk);
        dto["payload"] = json!(&payload[offset..end]);
        call(store, "prepare", dto)?;
        offset = end;
        chunk += 1;
    }
    let mut dto = handle.clone();
    dto["chunkCount"] = json!(chunk);
    dto["fingerprint"] = json!(fingerprint);
    let sealed = call(store, "seal", dto)?;
    let mut dto = handle.clone();
    dto["capability"] = sealed["capability"].clone();
    dto["fingerprint"] = json!(fingerprint);
    call(store, "commit", dto)
}
fn put(table: &str, key: &str, value: Value) -> Value {
    json!({"kind":"put","table":table,"key":key,"value":value})
}
fn get(store: &mut FullProductStore, h: &Value, table: &str, key: &str) -> Value {
    let mut dto = h.clone();
    dto["table"] = json!(table);
    dto["keys"] = json!([key]);
    call(store, "get", dto).unwrap()["rows"][0].clone()
}
fn scan(
    store: &mut FullProductStore,
    h: &Value,
    table: &str,
    index: Option<&str>,
) -> Result<Value> {
    let mut dto = h.clone();
    dto["query"] = json!({"table":table,"index":index,"selector":{"kind":"all"},"reverse":false,"cursor":null,"pageSize":256});
    call(store, "query", dto)
}
fn dispose(mut store: FullProductStore) {
    let root = store.root.clone();
    store.close().unwrap();
    drop(store);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn all_current_tables_keys_and_own_undefined_reopen_losslessly() {
    let mut store = fixture(Hooks::default());
    let names = registry::tables()
        .keys()
        .map(String::as_str)
        .collect::<Vec<_>>();
    let h = begin(&mut store, &names);
    let mutations = names
        .iter()
        .map(|name| {
            let def = registry::table(name).unwrap();
            put(
                name,
                "one",
                encoded(vec![
                    (def.key_path.as_str(), json!(["str", "one"])),
                    ("clear", json!(["undef"])),
                    ("rawToolArguments", json!(["str", "{\"exact\": true}\n"])),
                    ("unknownLone", json!(["utf16", [0xd800]])),
                ]),
            )
        })
        .collect();
    let receipt = finish(&mut store, &h, mutations).unwrap();
    assert_eq!(receipt["tables"].as_array().unwrap().len(), names.len());
    let root = store.root.clone();
    let workspace = store.workspace_id.clone();
    store.close().unwrap();
    drop(store);
    let mut store = FullProductStore::open(root, false, Hooks::default()).unwrap();
    assert_eq!(store.workspace_id, workspace);
    for name in names {
        let h = begin(&mut store, &[name]);
        let value = get(&mut store, &h, name, "one");
        assert_eq!(
            registry::field(&value["row"]["value"], "clear"),
            Some(&json!(["undef"]))
        );
        call(&mut store, "abort", h).unwrap();
    }
    dispose(store);
}
#[test]
fn failed_final_ledger_rolls_back_all_business_rows_and_receipt() {
    let hooks = Hooks::new(|point| {
        if point == "product-precommit" {
            Err(Error::new("test", "Injected final ledger failure"))
        } else {
            Ok(())
        }
    });
    let mut store = fixture(hooks);
    let h = begin(&mut store, &["projects", "agentToolCalls"]);
    assert_eq!(
        finish(
            &mut store,
            &h,
            vec![
                put("projects", "p", row("p", vec![])),
                put(
                    "agentToolCalls",
                    "call",
                    row("call", vec![("status", json!(["str", "completed"]))])
                )
            ]
        )
        .unwrap_err()
        .code,
        "test"
    );
    let h = begin(&mut store, &["projects", "agentToolCalls"]);
    assert!(get(&mut store, &h, "projects", "p").is_null());
    assert!(get(&mut store, &h, "agentToolCalls", "call").is_null());
    assert_eq!(store.sequence().unwrap(), 0);
    dispose(store);
}
#[test]
fn optional_compound_unique_constraints_and_index_tie_order_are_real_sqlite() {
    let mut store = fixture(Hooks::default());
    let h = begin(&mut store, &["shots", "agentGenerationJobs"]);
    finish(
        &mut store,
        &h,
        vec![
            put("shots", "z", row("z", vec![("order", json!(["num", 1]))])),
            put("shots", "a", row("a", vec![("order", json!(["num", 1]))])),
            put("agentGenerationJobs", "a", row("a", vec![])),
            put(
                "agentGenerationJobs",
                "b",
                row("b", vec![("batchItemId", json!(["undef"]))]),
            ),
        ],
    )
    .unwrap();
    let h = begin(&mut store, &["shots"]);
    let page = scan(&mut store, &h, "shots", Some("order")).unwrap();
    assert_eq!(page["rows"][0]["row"]["key"], "a");
    assert_eq!(page["rows"][1]["row"]["key"], "z");
    let h = begin(&mut store, &["agentToolCalls"]);
    let entries = vec![
        put(
            "agentToolCalls",
            "a",
            row(
                "a",
                vec![
                    ("runId", json!(["str", "run"])),
                    ("providerCallId", json!(["str", "call"])),
                ],
            ),
        ),
        put(
            "agentToolCalls",
            "b",
            row(
                "b",
                vec![
                    ("runId", json!(["str", "run"])),
                    ("providerCallId", json!(["str", "call"])),
                ],
            ),
        ),
    ];
    assert_eq!(
        finish(&mut store, &h, entries).unwrap_err().code,
        "constraint"
    );
    let h = begin(&mut store, &["agentToolCalls"]);
    assert_eq!(
        scan(&mut store, &h, "agentToolCalls", None).unwrap()["rows"]
            .as_array()
            .unwrap()
            .len(),
        0
    );
    dispose(store);
}
#[test]
fn point_absence_phantom_and_delete_recreate_aba_all_conflict() {
    let mut store = fixture(Hooks::default());
    let absent = begin(&mut store, &["projects"]);
    assert!(get(&mut store, &absent, "projects", "p").is_null());
    let writer = begin(&mut store, &["projects"]);
    finish(
        &mut store,
        &writer,
        vec![put("projects", "p", row("p", vec![]))],
    )
    .unwrap();
    assert_eq!(
        finish(
            &mut store,
            &absent,
            vec![put("projects", "other", row("other", vec![]))]
        )
        .unwrap_err()
        .code,
        "conflict"
    );
    let phantom = begin(&mut store, &["media"]);
    assert!(
        scan(&mut store, &phantom, "media", Some("projectId")).unwrap()["rows"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    let writer = begin(&mut store, &["media"]);
    finish(
        &mut store,
        &writer,
        vec![put(
            "media",
            "m",
            row("m", vec![("projectId", json!(["str", "p"]))]),
        )],
    )
    .unwrap();
    assert_eq!(
        call(&mut store, "validate", phantom).unwrap_err().code,
        "conflict"
    );
    let aba = begin(&mut store, &["projects"]);
    get(&mut store, &aba, "projects", "p");
    let writer = begin(&mut store, &["projects"]);
    finish(
        &mut store,
        &writer,
        vec![
            json!({"kind":"delete","table":"projects","key":"p"}),
            put("projects", "p", row("p", vec![])),
        ],
    )
    .unwrap();
    assert_eq!(
        call(&mut store, "validate", aba).unwrap_err().code,
        "conflict"
    );
    dispose(store);
}
#[test]
fn lost_commit_reply_durable_lookup_reopen_and_changed_payload_id_reject() {
    let hooks = Hooks::new(|point| {
        if point == "product-committed" {
            Err(Error::new("test", "Lost acknowledgement"))
        } else {
            Ok(())
        }
    });
    let mut store = fixture(hooks);
    let h = begin(&mut store, &["projects"]);
    assert_eq!(
        finish(&mut store, &h, vec![put("projects", "p", row("p", vec![]))])
            .unwrap_err()
            .code,
        "test"
    );
    let fp: String = store
        .db
        .query_row(
            "SELECT fingerprint FROM product_operations WHERE operation_id=?",
            [h["operationId"].as_str().unwrap()],
            |r| r.get(0),
        )
        .unwrap();
    let root = store.root.clone();
    store.close().unwrap();
    drop(store);
    let mut store = FullProductStore::open(root, false, Hooks::default()).unwrap();
    let reply = call(
        &mut store,
        "status",
        json!({"operationId":h["operationId"],"fingerprint":fp}),
    )
    .unwrap();
    assert_eq!(reply["status"], "committed");
    let r = begin(&mut store, &["projects"]);
    assert!(!get(&mut store, &r, "projects", "p").is_null());
    assert_eq!(
        call(
            &mut store,
            "status",
            json!({"operationId":h["operationId"],"fingerprint":"a".repeat(64)})
        )
        .unwrap_err()
        .code,
        "invalid"
    );
    assert_eq!(call(&mut store, "validate", h).unwrap_err().code, "closed");
    dispose(store);
}
#[test]
fn chunked_large_row_and_paged_epoch_no_whole_database_preload() {
    let mut store = fixture(Hooks::default());
    let h = begin(&mut store, &["chatMessages"]);
    let raw = "🌹".repeat(100000);
    let mutation = put(
        "chatMessages",
        "message",
        row("message", vec![("body", json!(["str", raw]))]),
    );
    let payload =
        serde_json::to_string(&json!({"kind":"mutation","mutation":mutation})).unwrap() + "\n";
    let mut sha = Sha256::new();
    sha.update(b"cuepoint-batch-v1\n");
    sha.update(payload.as_bytes());
    let fp = paths::hex_digest(sha.finalize());
    let mut offset = 0;
    let mut chunks = 0;
    while offset < payload.len() {
        let mut end = (offset + 32768).min(payload.len());
        while !payload.is_char_boundary(end) {
            end -= 1;
        }
        let mut d = h.clone();
        d["chunkIndex"] = json!(chunks);
        d["payload"] = json!(&payload[offset..end]);
        call(&mut store, "prepare", d).unwrap();
        chunks += 1;
        offset = end;
    }
    let mut d = h.clone();
    d["chunkCount"] = json!(chunks);
    d["fingerprint"] = json!(fp);
    let seal = call(&mut store, "seal", d).unwrap();
    let mut d = h.clone();
    d["capability"] = seal["capability"].clone();
    d["fingerprint"] = json!(fp);
    call(&mut store, "commit", d).unwrap();
    let h = begin(&mut store, &["chatMessages"]);
    let value = get(&mut store, &h, "chatMessages", "message");
    assert_eq!(value["kind"], "transfer");
    let mut offset = 0;
    let mut bytes = String::new();
    loop {
        let mut d = h.clone();
        d["transferId"] = value["transferId"].clone();
        d["offset"] = json!(offset);
        d["byteLength"] = json!(262144);
        let page = call(&mut store, "readTransfer", d).unwrap();
        assert!(page["payload"].as_str().unwrap().len() <= 32768);
        assert!(serde_json::to_vec(&page).unwrap().len() <= 262144);
        bytes.push_str(page["payload"].as_str().unwrap());
        offset = page["offset"].as_u64().unwrap();
        if page["end"] == true {
            break;
        }
    }
    let result: Value = serde_json::from_str(&bytes).unwrap();
    assert_eq!(registry::field(&result["value"], "body").unwrap()[1], raw);
    dispose(store);
}
#[test]
fn closed_dtos_readonly_scope_unknown_indexes_and_binary_bags_reject() {
    assert!(
        serde_json::from_value::<Request>(json!({"type":"open","request":{"path":"/tmp"}}))
            .is_err()
    );
    let mut store = fixture(Hooks::default());
    let h = begin(&mut store, &["projects"]);
    assert_eq!(
        scan(&mut store, &h, "shots", None).unwrap_err().code,
        "invalid"
    );
    assert_eq!(
        scan(&mut store, &h, "projects", Some("sql"))
            .unwrap_err()
            .code,
        "invalid"
    );
    let fake = json!(["binary",{"version":1,"workspaceId":store.workspace_id,"binaryId":uuid::Uuid::new_v4().to_string(),"byteLength":1,"mimeType":"image/png","contentHash":"a".repeat(64)}]);
    let h = begin(&mut store, &["projects"]);
    assert_eq!(
        finish(
            &mut store,
            &h,
            vec![put("projects", "p", row("p", vec![("extra", fake)]))]
        )
        .unwrap_err()
        .code,
        "invalid"
    );
    dispose(store);
}
#[test]
fn committed_changes_contain_indexes_only_and_indexed_table_epoch_is_monotonic() {
    let mut store = fixture(Hooks::default());
    let h = begin(&mut store, &["connectors"]);
    finish(
        &mut store,
        &h,
        vec![put(
            "connectors",
            "c",
            row(
                "c",
                vec![
                    ("apiKey", json!(["str", "secret-never-in-change"])),
                    ("definitionId", json!(["str", "supplier"])),
                ],
            ),
        )],
    )
    .unwrap();
    let reply = call(
        &mut store,
        "changes",
        json!({"changeSequence":1,"cursor":null,"pageSize":256}),
    )
    .unwrap();
    assert!(!reply.to_string().contains("secret-never-in-change"));
    assert_eq!(
        reply["changes"][0]["after"]["definitionId"]["value"],
        "supplier"
    );
    dispose(store);
}

#[test]
fn utf16_primary_identity_and_indexes_have_no_new_user_cap() {
    let mut store = fixture(Hooks::default());
    let cases = vec![
        json!(""),
        json!("nul\0identity"),
        json!("x".repeat(20_000)),
        json!({"utf16":[0xd800,0,0xdc00]}),
    ];
    for key in cases {
        let h = begin(&mut store, &["projects"]);
        let encodedkey = if key.is_string() {
            json!(["str", key])
        } else {
            json!(["utf16", key["utf16"]])
        };
        finish(&mut store,&h,vec![json!({"kind":"put","table":"projects","key":key,"value":encoded(vec![("id",encodedkey)])})]).unwrap();
        let read = begin(&mut store, &["projects"]);
        let mut dto = read.clone();
        dto["table"] = json!("projects");
        dto["keys"] = json!([key]);
        let reply = call(&mut store, "get", dto).unwrap();
        assert_eq!(reply["rows"][0]["row"]["key"], key);
    }
    let h = begin(&mut store, &["projects"]);
    let mut dto = h.clone();
    dto["query"] = json!({"table":"projects","index":"id","selector":{"kind":"equals","keys":[{"kind":"string","value":{"utf16":[0xd800,0,0xdc00]}}]},"reverse":false,"cursor":null,"pageSize":256});
    let rows = call(&mut store, "query", dto).unwrap();
    assert_eq!(rows["rows"].as_array().unwrap().len(), 1);
    assert_eq!(
        rows["rows"][0]["row"]["key"],
        json!({"utf16":[0xd800,0,0xdc00]})
    );
    let root = store.root.clone();
    store.close().unwrap();
    drop(store);
    dispose(FullProductStore::open(root, false, Hooks::default()).unwrap());
}
#[test]
fn durable_operation_identity_never_replays_a_known_or_pending_result() {
    let mut store = fixture(Hooks::default());
    let h = begin(&mut store, &["projects"]);
    call(&mut store, "abort", h.clone()).unwrap();
    assert!(
        call(
            &mut store,
            "begin",
            json!({"operationId":h["operationId"],"mode":"rw","tables":["projects"]})
        )
        .is_err()
    );
    let h = begin(&mut store, &["projects"]);
    let root = store.root.clone();
    store.close().unwrap();
    drop(store);
    let mut store = FullProductStore::open(root, false, Hooks::default()).unwrap();
    assert!(
        call(
            &mut store,
            "begin",
            json!({"operationId":h["operationId"],"mode":"rw","tables":["projects"]})
        )
        .is_err()
    );
    dispose(store);
}

fn read_request(
    store: &mut FullProductStore,
    handle: &Value,
    purpose: &str,
    payload: &str,
) -> Result<Value> {
    let mut dto = handle.clone();
    dto["purpose"] = json!(purpose);
    let transfer = call(store, "requestStart", dto)?;
    let mut offset = 0;
    while offset < payload.len() {
        let mut end = (offset + 32768).min(payload.len());
        while !payload.is_char_boundary(end) {
            end -= 1;
        }
        let mut dto = handle.clone();
        dto["transferId"] = transfer["transferId"].clone();
        dto["offset"] = json!(offset);
        dto["payload"] = json!(&payload[offset..end]);
        let reply = call(store, "requestChunk", dto)?;
        assert_eq!(reply["nextOffset"], end);
        offset = end;
    }
    let mut dto = handle.clone();
    dto["transferId"] = transfer["transferId"].clone();
    call(store, "requestFinish", dto)
}
#[test]
fn oversized_read_request_is_closed_bound_consumed_and_lossless() {
    let mut store = fixture(Hooks::default());
    let identity = "界\0".repeat(100_000);
    let h = begin(&mut store, &["projects"]);
    finish(
        &mut store,
        &h,
        vec![put("projects", &identity, row(&identity, vec![]))],
    )
    .unwrap();
    let h = begin(&mut store, &["projects"]);
    let payload = serde_json::to_string(&json!({"table":"projects", "keys":[identity]})).unwrap();
    assert!(payload.len() > 262144);
    let mut direct = h.clone();
    direct["table"] = json!("projects");
    direct["keys"] = json!([identity]);
    assert_eq!(call(&mut store, "get", direct).unwrap_err().code, "invalid");
    let result = read_request(&mut store, &h, "get", &payload).unwrap();
    assert_eq!(result["rows"][0]["kind"], "transfer");
    let transfer = result["rows"][0]["transferId"].clone();
    let mut offset = 0;
    let mut row_payload = String::new();
    loop {
        let mut dto = h.clone();
        dto["transferId"] = transfer.clone();
        dto["offset"] = json!(offset);
        dto["byteLength"] = json!(32768);
        let reply = call(&mut store, "readTransfer", dto).unwrap();
        row_payload.push_str(reply["payload"].as_str().unwrap());
        offset = reply["offset"].as_u64().unwrap();
        if reply["end"] == true {
            break;
        }
    }
    assert_eq!(
        serde_json::from_str::<Value>(&row_payload).unwrap()["key"],
        identity
    );
    let malformed = serde_json::to_string(
        &json!({"table":"projects", "keys":[identity], "sql":"DELETE FROM product_records"}),
    )
    .unwrap();
    assert!(read_request(&mut store, &h, "get", &malformed).is_err());
    let mut dto = h.clone();
    dto["purpose"] = json!("get");
    let transfer = call(&mut store, "requestStart", dto).unwrap();
    let mut dto = h.clone();
    dto["transferId"] = transfer["transferId"].clone();
    dto["offset"] = json!(1);
    dto["payload"] = json!("{}");
    assert_eq!(
        call(&mut store, "requestChunk", dto).unwrap_err().code,
        "invalid"
    );
    let mut dto = h.clone();
    dto["transferId"] = transfer["transferId"].clone();
    dto["offset"] = json!(0);
    dto["payload"] = json!("{}");
    call(&mut store, "requestChunk", dto).unwrap();
    let mut dto = h.clone();
    dto["transferId"] = transfer["transferId"].clone();
    assert!(call(&mut store, "requestFinish", dto.clone()).is_err());
    assert_eq!(
        call(&mut store, "requestFinish", dto).unwrap_err().code,
        "closed"
    );
    dispose(store);
}
#[test]
fn indexed_limit_and_aggregate_count_preserve_total_order_bytes_and_phantom_guard() {
    let mut store = fixture(Hooks::default());
    let h = begin(&mut store, &["chatMessages"]);
    let rows = (0..24)
        .map(|n| {
            let id = format!("{n:02}");
            put(
                "chatMessages",
                &id,
                row(
                    &id,
                    vec![
                        ("threadId", json!(["str", "selected"])),
                        ("content", json!(["str", "x".repeat(8192)])),
                    ],
                ),
            )
        })
        .collect();
    finish(&mut store, &h, rows).unwrap();
    let h = begin(&mut store, &["chatMessages"]);
    let base = json!({"table":"chatMessages","index":"threadId","selector":{"kind":"equals","keys":[{"kind":"string","value":"selected"}]},"reverse":true,"cursor":null,"pageSize":256,"limit":10});
    let mut cursor = Value::Null;
    let mut ids = Vec::new();
    loop {
        let mut dto = h.clone();
        let mut query = base.clone();
        query["cursor"] = cursor;
        dto["query"] = query;
        let response = call(&mut store, "query", dto).unwrap();
        ids.extend(
            response["rows"]
                .as_array()
                .unwrap()
                .iter()
                .map(|r| r["row"]["key"].as_str().unwrap().to_string()),
        );
        cursor = response["cursor"].clone();
        if cursor.is_null() {
            break;
        }
    }
    assert_eq!(
        ids,
        (14..24)
            .rev()
            .map(|n| format!("{n:02}"))
            .collect::<Vec<_>>()
    );
    let mut dto = h.clone();
    dto["query"] = base.clone();
    assert_eq!(call(&mut store, "count", dto).unwrap(), json!({"count":10}));
    let mut aggregate = base.clone();
    aggregate["limit"] = Value::Null;
    let payload = serde_json::to_string(&json!({"query":aggregate})).unwrap();
    assert_eq!(
        read_request(&mut store, &h, "count", &payload).unwrap(),
        json!({"count":24})
    );
    let mut zero = base;
    zero["limit"] = json!(0);
    let mut dto = h.clone();
    dto["query"] = zero;
    assert_eq!(call(&mut store, "query", dto).unwrap()["rows"], json!([]));
    let write = begin(&mut store, &["chatMessages"]);
    finish(
        &mut store,
        &write,
        vec![put(
            "chatMessages",
            "new",
            row("new", vec![("threadId", json!(["str", "selected"]))]),
        )],
    )
    .unwrap();
    assert_eq!(
        call(&mut store, "validate", h).unwrap_err().code,
        "conflict"
    );
    dispose(store);
}

#[test]
fn encoded_metadata_envelopes_are_bounded_even_for_control_heavy_chunks() {
    let mut store = fixture(Hooks::default());
    let handle = begin(&mut store, &["projects"]);
    let mut dto = handle.clone();
    dto["purpose"] = json!("get");
    let transfer = call(&mut store, "requestStart", dto).unwrap();
    let mut dto = handle;
    dto["transferId"] = transfer["transferId"].clone();
    dto["offset"] = json!(0);
    dto["payload"] = json!("\0".repeat(32768));
    let request: Request =
        serde_json::from_value(json!({"type":"requestChunk", "request":dto})).unwrap();
    assert!(
        serde_json::to_vec(&json!({"request":request}))
            .unwrap()
            .len()
            < 262144
    );
    request.validate_wire().unwrap();
    let text = "\0\n\r\t\u{0001}".repeat(20000);
    let response = string_chunk(&text, 0, 262144).unwrap();
    assert_eq!(response["payload"].as_str().unwrap().len(), 32768);
    assert!(serde_json::to_vec(&response).unwrap().len() < 262144);
    dispose(store);
}

fn downgrade_to_legacy_registry(root: &std::path::Path, extra_missing: Option<&str>) {
    let db = rusqlite::Connection::open(root.join(".local/state.sqlite")).unwrap();
    db.execute("DELETE FROM product_tables WHERE name IN ('deviceSettings','agentJobs','agentJobResultChunks','desktopMediaImports')", [])
        .unwrap();
    if let Some(name) = extra_missing {
        db.execute("DELETE FROM product_tables WHERE name=?", [name])
            .unwrap();
    }
    db.execute(
        "UPDATE product_workspace SET registry_hash=?",
        ["a3405d1995059418dc36f69a9ff547c53ebe1c500a4aa64da642be4c6585af85"],
    )
    .unwrap();
}
#[test]
fn legacy_49_registry_is_not_silently_migrated_to_current_53() {
    let mut store = fixture(Hooks::default());
    let root = store.root.clone();
    store.close().unwrap();
    drop(store);
    downgrade_to_legacy_registry(&root, None);
    let error = FullProductStore::open(root.clone(), false, Hooks::default()).err().unwrap();
    assert_eq!(error.code, "schema");
    let db = rusqlite::Connection::open(root.join(".local/state.sqlite")).unwrap();
    let (rows, device, hash): (i64, i64, String) = db.query_row(
        "SELECT (SELECT count(*) FROM product_tables),(SELECT count(*) FROM product_tables WHERE name='deviceSettings'),(SELECT registry_hash FROM product_workspace)", [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).unwrap();
    assert_eq!(rows, 49);
    assert_eq!(device, 0);
    assert_eq!(hash, LEGACY_REGISTRY_HASH);
    drop(db);
    std::fs::remove_dir_all(root).unwrap();
}
#[test]
fn legacy_registry_with_other_differences_is_still_rejected() {
    let mut store = fixture(Hooks::default());
    let root = store.root.clone();
    store.close().unwrap();
    drop(store);
    downgrade_to_legacy_registry(&root, Some("projects"));
    let error = FullProductStore::open(root.clone(), false, Hooks::default())
        .err()
        .unwrap();
    assert_eq!(error.code, "schema");
    let db = rusqlite::Connection::open(root.join(".local/state.sqlite")).unwrap();
    let rows: i64 = db
        .query_row(
            "SELECT count(*) FROM product_tables WHERE name='deviceSettings'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(rows, 0);
    drop(db);
    fs::remove_dir_all(&root).unwrap();
}
