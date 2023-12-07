use crate::{db_connector::db_connector, sidebar::sidebar};
use leptos::html::{div, main};
use leptos::*;

pub fn layout(children: Children) -> impl IntoView {
    div().attr("class", "flex h-screen").child(sidebar()).child(
        div()
            .attr("class", "flex flex-col flex-1 overflow-hidden")
            .child(db_connector())
            .child(
                main()
                    .attr("class", "flex-1 overflow-y-scroll")
                    .child(children()),
            ),
    )
}

