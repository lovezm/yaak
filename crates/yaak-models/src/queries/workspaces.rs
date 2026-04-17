use crate::db_context::DbContext;
use crate::error::Result;
use crate::models::{
    EnvironmentIden, FolderIden, GrpcRequestIden, HttpRequestHeader, HttpRequestIden,
    WebsocketRequestIden, Workspace, WorkspaceIden,
};
use crate::util::UpdateSource;
use serde_json::Value;
use std::collections::BTreeMap;

impl<'a> DbContext<'a> {
    pub fn get_workspace(&self, id: &str) -> Result<Workspace> {
        self.find_one(WorkspaceIden::Id, id)
    }

    pub fn list_workspaces(&self) -> Result<Vec<Workspace>> {
        let mut workspaces = self.find_all()?;

        if workspaces.is_empty() {
            workspaces.push(self.upsert_workspace(
                &Workspace {
                    name: "Yaak".to_string(),
                    setting_follow_redirects: true,
                    setting_validate_certificates: true,
                    ..Default::default()
                },
                &UpdateSource::Background,
            )?)
        }

        Ok(workspaces)
    }

    pub fn delete_workspace(
        &self,
        workspace: &Workspace,
        source: &UpdateSource,
    ) -> Result<Workspace> {
        for m in self.find_many(HttpRequestIden::WorkspaceId, &workspace.id, None)? {
            self.delete_http_request(&m, source)?;
        }

        for m in self.find_many(GrpcRequestIden::WorkspaceId, &workspace.id, None)? {
            self.delete_grpc_request(&m, source)?;
        }

        for m in self.find_many(WebsocketRequestIden::FolderId, &workspace.id, None)? {
            self.delete_websocket_request(&m, source)?;
        }

        for m in self.find_many(FolderIden::WorkspaceId, &workspace.id, None)? {
            self.delete_folder(&m, source)?;
        }

        for m in self.find_many(EnvironmentIden::WorkspaceId, &workspace.id, None)? {
            self.delete_environment(&m, source)?;
        }

        self.delete(workspace, source)
    }

    pub fn delete_workspace_by_id(&self, id: &str, source: &UpdateSource) -> Result<Workspace> {
        let workspace = self.get_workspace(id)?;
        self.delete_workspace(&workspace, source)
    }

    pub fn upsert_workspace(&self, w: &Workspace, source: &UpdateSource) -> Result<Workspace> {
        self.upsert(w, source)
    }

    pub fn resolve_auth_for_workspace(
        &self,
        workspace: &Workspace,
    ) -> (Option<String>, BTreeMap<String, Value>, String) {
        (
            workspace.authentication_type.clone(),
            workspace.authentication.clone(),
            workspace.id.clone(),
        )
    }

    pub fn resolve_headers_for_workspace(&self, workspace: &Workspace) -> Vec<HttpRequestHeader> {
        let mut headers = default_headers();
        headers.extend(workspace.headers.clone());
        headers
    }
}

/// Global default headers that are always sent with requests unless overridden.
/// These are prepended to the inheritance chain so workspace/folder/request headers
/// can override or disable them.
pub fn default_headers() -> Vec<HttpRequestHeader> {
    vec![
        HttpRequestHeader {
            enabled: true,
            name: "User-Agent".to_string(),
            value: default_user_agent().to_string(),
            id: None,
        },
        HttpRequestHeader {
            enabled: true,
            name: "Accept".to_string(),
            value: "*/*".to_string(),
            id: None,
        },
    ]
}

fn default_user_agent() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    }

    #[cfg(target_os = "windows")]
    {
        "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.87 Safari/537.36"
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    }
}

#[cfg(test)]
mod tests {
    use super::default_headers;

    #[test]
    fn default_headers_include_browser_user_agent() {
        let user_agent = default_headers()
            .into_iter()
            .find(|header| header.name.eq_ignore_ascii_case("user-agent"))
            .expect("default user-agent header should exist");

        assert_ne!(user_agent.value, "yaak");
        assert!(
            user_agent.value.starts_with("Mozilla/5.0"),
            "unexpected user-agent: {}",
            user_agent.value
        );
    }
}
