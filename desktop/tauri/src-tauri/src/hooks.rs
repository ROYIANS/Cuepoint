use crate::Result;
#[cfg(feature = "test-hooks")]
type Callback = std::sync::Arc<dyn Fn(&str) -> Result<()> + Send + Sync>;

#[derive(Clone, Default)]
pub struct Hooks {
    #[cfg(feature = "test-hooks")]
    callback: Option<Callback>,
}
impl Hooks {
    #[cfg(feature = "test-hooks")]
    pub fn new(callback: impl Fn(&str) -> Result<()> + Send + Sync + 'static) -> Self {
        Self {
            callback: Some(std::sync::Arc::new(callback)),
        }
    }
    pub(crate) fn hit(&self, point: &str) -> Result<()> {
        #[cfg(feature = "test-hooks")]
        if let Some(callback) = &self.callback {
            return callback(point);
        }
        let _ = point;
        Ok(())
    }
}
