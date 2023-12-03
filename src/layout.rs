use leptos::*;

use crate::{db_connector::DBConnector, sidebar::Sidebar};

#[component]
pub fn Layout(children: Children) -> impl IntoView {
    view! {
        <div class="w-screen h-screen">
            <div class="flex flex-row">
            <Sidebar/>
            <div class="flex grow flex-col overflow-auto">
                <DBConnector/>
                <main class="">
                    {children()}
                </main>
            </div>
            </div>
        </div>
    }
}
