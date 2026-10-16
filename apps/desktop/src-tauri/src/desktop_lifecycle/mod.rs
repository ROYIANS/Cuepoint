//! Native lifetime of the one retained product document.
#[cfg(feature = "desktop")]
pub(crate) mod native;
pub(crate) mod singleton;
use crate::{Error, Result, full_product_store::protocol::Session};
use serde::{Deserialize, Serialize};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
};
use tokio::sync::Notify;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Phase {
    Running,
    CheckingDrafts,
    Quiescing,
    Exiting,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct Envelope {
    pub version: u32,
    pub session: Option<Session>,
    pub action: Action,
}
#[derive(Deserialize)]
#[serde(
    tag = "kind",
    deny_unknown_fields,
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub(crate) enum Action {
    Status {},
    GuardStatus {
        intent_id: String,
        status: GuardStatus,
    },
    GuardDecision {
        intent_id: String,
        decision: GuardDecision,
    },
    Drained {
        intent_id: String,
        outcome: DrainOutcome,
    },
}
#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum GuardStatus {
    Clear,
    DecisionRequired,
}
#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum GuardDecision {
    Proceed,
    Cancel,
}
#[derive(Clone, Copy, Deserialize, Debug)]
#[serde(rename_all = "snake_case")]
pub(crate) enum DrainOutcome {
    Drained,
    Interrupted,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Snapshot {
    pub version: u32,
    pub phase: Phase,
    pub intent_id: Option<String>,
    pub session: Option<Session>,
    pub visible: bool,
    pub focused: bool,
}
pub(crate) struct Intent {
    pub id: String,
    pub session: Option<Session>,
    pub changed: Notify,
    guard: Mutex<GuardState>,
    pub drained: Notify,
    outcome: Mutex<Option<DrainOutcome>>,
}
#[derive(Clone, Copy, PartialEq)]
pub(crate) enum GuardState {
    Waiting,
    Human,
    Proceed,
    Cancel,
}
struct State {
    phase: Phase,
    session: Option<Session>,
    attached: bool,
    intent: Option<Arc<Intent>>,
}
pub(crate) struct Lifecycle {
    state: Mutex<State>,
    pub activation: Arc<singleton::ActivationState>,
    pub effects: Arc<AtomicBool>,
}
impl Default for Lifecycle {
    fn default() -> Self {
        Self {
            state: Mutex::new(State {
                phase: Phase::Running,
                session: None,
                attached: false,
                intent: None,
            }),
            activation: Arc::new(singleton::ActivationState::default()),
            effects: Arc::new(AtomicBool::new(true)),
        }
    }
}
fn same_session(a: &Option<Session>, b: &Option<Session>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(a), Some(b)) => {
            a.version == b.version
                && a.session == b.session
                && a.workspace_id == b.workspace_id
                && a.generation == b.generation
        }
        _ => false,
    }
}
impl Lifecycle {
    pub(crate) fn phase(&self) -> Phase {
        self.state.lock().unwrap().phase
    }
    pub(crate) fn admit_effect(&self) -> Result<()> {
        if matches!(self.phase(), Phase::Quiescing | Phase::Exiting) {
            return Err(Error::new("closing", "Application is shutting down"));
        }
        Ok(())
    }
    pub(crate) fn detach(&self) {
        let mut state = self.state.lock().unwrap();
        state.attached = false;
        state.session = None;
        if let Some(intent) = &state.intent {
            *intent.guard.lock().unwrap() = GuardState::Proceed;
            intent.changed.notify_one();
        }
    }
    pub(crate) fn attach(&self, session: Option<Session>) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        if state.phase != Phase::Running
            && (!state.attached || !same_session(&state.session, &session))
        {
            return Err(Error::new("closing", "Application is shutting down"));
        }
        state.session = session;
        state.attached = true;
        Ok(())
    }
    pub(crate) fn snapshot(&self, visible: bool, focused: bool) -> Snapshot {
        let state = self.state.lock().unwrap();
        Snapshot {
            version: 1,
            phase: state.phase,
            intent_id: state.intent.as_ref().map(|i| i.id.clone()),
            session: state.session.clone(),
            visible,
            focused,
        }
    }
    pub(crate) fn begin(&self) -> Option<Arc<Intent>> {
        let mut state = self.state.lock().unwrap();
        if state.phase != Phase::Running {
            return None;
        }
        let intent = Arc::new(Intent {
            id: uuid::Uuid::new_v4().to_string(),
            session: state.session.clone(),
            changed: Notify::new(),
            guard: Mutex::new(GuardState::Waiting),
            drained: Notify::new(),
            outcome: Mutex::new(None),
        });
        state.phase = Phase::CheckingDrafts;
        state.intent = Some(intent.clone());
        Some(intent)
    }
    pub(crate) fn acknowledge(&self, session: &Option<Session>, action: Action) -> Result<bool> {
        let state = self.state.lock().unwrap();
        let Some(intent) = &state.intent else {
            return Err(Error::new("closed", "Quit intent is no longer current"));
        };
        let id = match &action {
            Action::GuardStatus { intent_id, .. }
            | Action::GuardDecision { intent_id, .. }
            | Action::Drained { intent_id, .. } => intent_id,
            Action::Status {} => return Err(Error::new("invalid", "Unexpected lifecycle status")),
        };
        if id != &intent.id
            || !state.attached
            || !same_session(session, &intent.session)
            || !same_session(session, &state.session)
        {
            return Err(Error::new("closed", "Quit acknowledgement owner changed"));
        }
        match action {
            Action::GuardStatus { status, .. } if state.phase == Phase::CheckingDrafts => {
                let mut guard = intent.guard.lock().unwrap();
                if *guard == GuardState::Waiting {
                    *guard = match status {
                        GuardStatus::Clear => GuardState::Proceed,
                        GuardStatus::DecisionRequired => GuardState::Human,
                    };
                    intent.changed.notify_one();
                }
            }
            Action::GuardDecision { decision, .. } if state.phase == Phase::CheckingDrafts => {
                let mut guard = intent.guard.lock().unwrap();
                if *guard != GuardState::Human {
                    return Err(Error::new("invalid", "No manual Quit decision is pending"));
                }
                *guard = match decision {
                    GuardDecision::Proceed => GuardState::Proceed,
                    GuardDecision::Cancel => GuardState::Cancel,
                };
                intent.changed.notify_one();
            }
            Action::Drained { outcome, .. } if state.phase == Phase::Quiescing => {
                let mut current = intent.outcome.lock().unwrap();
                if current.is_none() {
                    *current = Some(outcome);
                    intent.drained.notify_one();
                }
            }
            _ => return Err(Error::new("closed", "Quit acknowledgement phase changed")),
        }
        Ok(true)
    }
    pub(crate) fn cancel(&self, intent: &Arc<Intent>) -> bool {
        let mut state = self.state.lock().unwrap();
        if state
            .intent
            .as_ref()
            .is_some_and(|i| Arc::ptr_eq(i, intent))
            && state.phase == Phase::CheckingDrafts
        {
            state.phase = Phase::Running;
            state.intent = None;
            true
        } else {
            false
        }
    }
    pub(crate) fn quiesce(&self, intent: &Arc<Intent>) -> bool {
        let mut state = self.state.lock().unwrap();
        if state
            .intent
            .as_ref()
            .is_some_and(|i| Arc::ptr_eq(i, intent))
            && state.phase == Phase::CheckingDrafts
        {
            self.effects.store(false, Ordering::SeqCst);
            state.phase = Phase::Quiescing;
            self.activation.closing.store(true, Ordering::Release);
            true
        } else {
            false
        }
    }
    pub(crate) fn exiting(&self) {
        self.state.lock().unwrap().phase = Phase::Exiting;
        self.activation.closing.store(true, Ordering::Release);
    }
}
impl Intent {
    pub(crate) fn guard(&self) -> GuardState {
        *self.guard.lock().unwrap()
    }
    pub(crate) fn outcome(&self) -> Option<DrainOutcome> {
        *self.outcome.lock().unwrap()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn desktop_lifecycle_quit_identity_cancel_and_quiesce_are_exact() {
        let lifecycle = Lifecycle::default();
        lifecycle.attach(None).unwrap();
        let first = lifecycle.begin().unwrap();
        assert!(lifecycle.begin().is_none());
        assert!(lifecycle.admit_effect().is_ok());
        assert!(
            lifecycle
                .acknowledge(
                    &None,
                    Action::GuardStatus {
                        intent_id: "foreign".into(),
                        status: GuardStatus::Clear
                    }
                )
                .is_err()
        );
        lifecycle
            .acknowledge(
                &None,
                Action::GuardStatus {
                    intent_id: first.id.clone(),
                    status: GuardStatus::DecisionRequired,
                },
            )
            .unwrap();
        lifecycle
            .acknowledge(
                &None,
                Action::GuardDecision {
                    intent_id: first.id.clone(),
                    decision: GuardDecision::Cancel,
                },
            )
            .unwrap();
        assert!(lifecycle.cancel(&first));
        assert!(lifecycle.admit_effect().is_ok());
        let second = lifecycle.begin().unwrap();
        assert_ne!(first.id, second.id);
        assert!(lifecycle.quiesce(&second));
        assert!(lifecycle.admit_effect().is_err());
        assert!(!lifecycle.cancel(&first));
        assert!(
            lifecycle
                .acknowledge(
                    &None,
                    Action::Drained {
                        intent_id: first.id.clone(),
                        outcome: DrainOutcome::Drained
                    }
                )
                .is_err()
        );
        lifecycle
            .acknowledge(
                &None,
                Action::Drained {
                    intent_id: second.id.clone(),
                    outcome: DrainOutcome::Interrupted,
                },
            )
            .unwrap();
        assert!(matches!(second.outcome(), Some(DrainOutcome::Interrupted)));
        lifecycle.exiting();
        assert_eq!(lifecycle.phase(), Phase::Exiting);
    }
    #[test]
    fn desktop_lifecycle_reload_and_session_replacement_reject_old_ack() {
        let lifecycle = Lifecycle::default();
        lifecycle.attach(None).unwrap();
        let intent = lifecycle.begin().unwrap();
        lifecycle.detach();
        assert!(
            lifecycle
                .acknowledge(
                    &None,
                    Action::GuardStatus {
                        intent_id: intent.id.clone(),
                        status: GuardStatus::Clear
                    }
                )
                .is_err()
        );
        assert!(lifecycle.attach(None).is_err());
        assert!(
            serde_json::from_value::<Envelope>(
                serde_json::json!({"version":1,"session":null,"action":{"kind":"quitNow"}})
            )
            .is_err()
        );
    }
}
