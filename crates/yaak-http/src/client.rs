use crate::dns::LocalhostResolver;
use crate::error::Result;
use log::{debug, info, warn};
use reqwest::{Client, Proxy, redirect};
use std::sync::Arc;
use yaak_models::models::DnsOverride;
use yaak_tls::{ClientCertificateConfig, get_tls_config};

#[derive(Clone, Debug)]
pub struct HttpConnectionProxySettingAuth {
    pub user: String,
    pub password: String,
}

#[derive(Clone, Debug)]
pub enum HttpConnectionProxySetting {
    Disabled,
    System,
    Enabled {
        http: String,
        https: String,
        auth: Option<HttpConnectionProxySettingAuth>,
        bypass: String,
    },
}

#[derive(Clone, Debug)]
pub struct HttpConnectionOptions {
    pub id: String,
    pub validate_certificates: bool,
    pub proxy: HttpConnectionProxySetting,
    pub client_certificate: Option<ClientCertificateConfig>,
    pub dns_overrides: Vec<DnsOverride>,
}

impl HttpConnectionOptions {
    pub fn cache_key(&self) -> String {
        let dns_overrides = self
            .dns_overrides
            .iter()
            .map(|override_item| {
                format!(
                    "{}|{:?}|{:?}|{}",
                    override_item.hostname,
                    override_item.ipv4,
                    override_item.ipv6,
                    override_item.enabled
                )
            })
            .collect::<Vec<_>>()
            .join(";");

        format!(
            "id={};validate={};proxy={:?};client_cert={:?};dns={}",
            self.id,
            self.validate_certificates,
            self.proxy,
            self.client_certificate,
            dns_overrides,
        )
    }

    /// Build a reqwest Client and return it along with the DNS resolver.
    /// The resolver is returned separately so it can be configured per-request
    /// to emit DNS timing events to the appropriate channel.
    pub(crate) fn build_client(&self) -> Result<(Client, Arc<LocalhostResolver>)> {
        let mut client = Client::builder()
            .connection_verbose(true)
            .redirect(redirect::Policy::none())
            // Decompression is handled by HttpTransaction, not reqwest
            .no_gzip()
            .no_brotli()
            .no_deflate()
            .referer(false)
            .tls_info(true)
            // Disable connection pooling to ensure DNS resolution happens on each request
            // This is needed so we can emit DNS timing events for each request
            .pool_max_idle_per_host(0);

        // Configure TLS with optional client certificate
        let config =
            get_tls_config(self.validate_certificates, true, self.client_certificate.clone())?;
        client = client.use_preconfigured_tls(config);

        // Configure DNS resolver - keep a reference to configure per-request
        let resolver = LocalhostResolver::new(self.dns_overrides.clone());
        client = client.dns_resolver(resolver.clone());

        // Configure proxy
        match self.proxy.clone() {
            HttpConnectionProxySetting::System => { /* Default */ }
            HttpConnectionProxySetting::Disabled => {
                client = client.no_proxy();
            }
            HttpConnectionProxySetting::Enabled { http, https, auth, bypass } => {
                for p in build_enabled_proxy(http, https, auth, bypass) {
                    client = client.proxy(p)
                }
            }
        }

        info!(
            "Building new HTTP client validate_certificates={} client_cert={}",
            self.validate_certificates,
            self.client_certificate.is_some()
        );

        Ok((client.build()?, resolver))
    }
}

fn build_enabled_proxy(
    http: String,
    https: String,
    auth: Option<HttpConnectionProxySettingAuth>,
    bypass: String,
) -> Vec<Proxy> {
    debug!("Using proxy http={http} https={https} bypass={bypass}");

    let mut proxies = Vec::new();
    let same_proxy = !http.is_empty() && http == https;

    if same_proxy {
        match Proxy::all(http.clone()) {
            Ok(mut proxy) => {
                if let Some(HttpConnectionProxySettingAuth { user, password }) = auth {
                    debug!("Using shared proxy auth");
                    proxy = proxy.basic_auth(user.as_str(), password.as_str());
                }
                proxies.push(proxy.no_proxy(reqwest::NoProxy::from_string(&bypass)));
            }
            Err(e) => {
                warn!("Failed to apply shared proxy {e:?}");
            }
        };
        return proxies;
    }

    if !http.is_empty() {
        match Proxy::http(http) {
            Ok(mut proxy) => {
                if let Some(HttpConnectionProxySettingAuth { user, password }) = auth.clone() {
                    debug!("Using http proxy auth");
                    proxy = proxy.basic_auth(user.as_str(), password.as_str());
                }
                proxies.push(proxy.no_proxy(reqwest::NoProxy::from_string(&bypass)));
            }
            Err(e) => {
                warn!("Failed to apply http proxy {e:?}");
            }
        };
    }

    if !https.is_empty() {
        match Proxy::https(https) {
            Ok(mut proxy) => {
                if let Some(HttpConnectionProxySettingAuth { user, password }) = auth {
                    debug!("Using https proxy auth");
                    proxy = proxy.basic_auth(user.as_str(), password.as_str());
                }
                proxies.push(proxy.no_proxy(reqwest::NoProxy::from_string(&bypass)));
            }
            Err(e) => {
                warn!("Failed to apply https proxy {e:?}");
            }
        };
    }

    proxies
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_key_changes_when_proxy_changes() {
        let base = HttpConnectionOptions {
            id: "ctx-1".to_string(),
            validate_certificates: true,
            proxy: HttpConnectionProxySetting::System,
            client_certificate: None,
            dns_overrides: Vec::new(),
        };
        let with_proxy = HttpConnectionOptions {
            proxy: HttpConnectionProxySetting::Enabled {
                http: "http://127.0.0.1:8080".to_string(),
                https: "http://127.0.0.1:8080".to_string(),
                auth: None,
                bypass: String::new(),
            },
            ..base.clone()
        };

        assert_ne!(base.cache_key(), with_proxy.cache_key());
    }

    #[test]
    fn shared_http_proxy_builds_single_proxy_rule() {
        let proxies = build_enabled_proxy(
            "http://127.0.0.1:8080".to_string(),
            "http://127.0.0.1:8080".to_string(),
            None,
            String::new(),
        );

        assert_eq!(proxies.len(), 1);
    }
}
