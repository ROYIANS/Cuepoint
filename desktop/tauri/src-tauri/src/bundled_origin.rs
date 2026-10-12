//! Exact packaged-main origin shared by navigation, IPC, permissions and media.
use tauri::Url;

#[derive(Clone, Copy)]
enum PackagedPlatform {
    Windows,
    UnixWebview,
}

impl PackagedPlatform {
    fn current() -> Self {
        if cfg!(target_os = "windows") {
            Self::Windows
        } else {
            Self::UnixWebview
        }
    }

    fn origin(self) -> &'static str {
        match self {
            Self::Windows => "http://tauri.localhost",
            Self::UnixWebview => "tauri://localhost",
        }
    }

    fn accepts(self, url: &Url) -> bool {
        let (scheme, host) = match self {
            Self::Windows => ("http", "tauri.localhost"),
            Self::UnixWebview => ("tauri", "localhost"),
        };
        url.scheme() == scheme
            && url.host_str() == Some(host)
            && url.port().is_none()
            && url.username().is_empty()
            && url.password().is_none()
            && url.query().is_none()
            && matches!(url.path(), "" | "/" | "/index.html")
    }
}

pub(crate) fn origin() -> &'static str {
    PackagedPlatform::current().origin()
}

pub(crate) fn accepts(url: &Url) -> bool {
    PackagedPlatform::current().accepts(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn both_platforms_accept_only_their_packaged_entry_and_hash_routes() {
        for platform in [PackagedPlatform::Windows, PackagedPlatform::UnixWebview] {
            for suffix in ["", "/", "/index.html", "/#/projects", "/index.html#/assets"] {
                let url = Url::parse(&format!("{}{suffix}", platform.origin())).unwrap();
                assert!(platform.accepts(&url), "{url}");
            }
            for suffix in [
                ":443/",
                ":8080/",
                "/?query",
                "/index.html?query#route",
                "/assets/main.js",
                "/projects",
                "/%69ndex.html",
                "/index.html/",
            ] {
                let url = Url::parse(&format!("{}{suffix}", platform.origin())).unwrap();
                assert!(!platform.accepts(&url), "{url}");
            }
        }
    }

    #[test]
    fn spoofed_hosts_credentials_and_cross_platform_origins_reject() {
        for platform in [PackagedPlatform::Windows, PackagedPlatform::UnixWebview] {
            for input in [
                "file:///index.html",
                "http://localhost/",
                "http://127.0.0.1/",
                "https://tauri.localhost/",
                "tauri://tauri.localhost/",
                "http://tauri.localhost.example/",
                "tauri://localhost.example/",
                "http://user@tauri.localhost/",
                "tauri://user@localhost/",
                "http://user:pass@tauri.localhost/",
                "tauri://user:pass@localhost/",
            ] {
                assert!(!platform.accepts(&Url::parse(input).unwrap()), "{input}");
            }
        }
        assert!(!PackagedPlatform::Windows.accepts(&Url::parse("tauri://localhost/").unwrap()));
        assert!(
            !PackagedPlatform::UnixWebview.accepts(&Url::parse("http://tauri.localhost/").unwrap())
        );
    }
}
