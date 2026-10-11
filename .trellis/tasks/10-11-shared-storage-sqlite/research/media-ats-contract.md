# Loopback media and packaged Apple transport policy

Observed on2026-10-12: the exploratory isolated application's actual `Contents/Info.plist` has no `NSAppTransportSecurity` entry (`PlistBuddy Print :NSAppTransportSecurity` exited1 with entry absent). This is a static packaged-policy observation, not WebKit playback acceptance.

Root reviewed Apple's current primary documentation through web search and the documentation's official Markdown resources:

- [NSAllowsLocalNetworking](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking): macOS14 and later no longer permit IP-address connections by default under ATS. The current guidance supports individual IP exceptions. Older local-network behavior is not adequate evidence for the current host.
- [NSExceptionDomains](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsexceptiondomains): IP-address entries are supported from macOS14; the key must omit ports. An exception for a DNS name is not an exception for its numeric IP, or vice versa.

The scoped correction is `NSAppTransportSecurity / NSExceptionDomains / 127.0.0.1 / NSExceptionAllowsInsecureHTTPLoads = true`. It contains no broad arbitrary-load exception, LAN range, wildcard or subdomain extension. Root authorized native_store_engine to own this narrow Info.plist edit under the user's delegated responsibility. Existing microphone purpose text remains.

Verify the rebuilt actual bundle contains this exact dictionary, alongside the narrow `media-src http://127.0.0.1:*` CSP and closed capability service. A plist check or raw HTTP pass cannot establish genuine WK playback, supplied-origin behavior or seeking. Those actual application-window checks remain pending until the locked host is available.
