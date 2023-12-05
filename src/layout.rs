use leptos::*;

use crate::{db_connector::DBConnector, sidebar::Sidebar};

#[component]
pub fn Layout(children: Children) -> impl IntoView {
    view! {
        <div class="flex h-screen">
            <Sidebar/>
            <div class="flex flex-col flex-1 overflow-hidden">
                <DBConnector/>
                <main class="flex-1 overflow-y-scroll">{children()}</main>
            </div>
        </div>
    }
}

