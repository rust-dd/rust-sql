use leptos::*;

use crate::store::query::QueryState;

#[component]
pub fn QueryTable() -> impl IntoView {
    let data = use_context::<QueryState>().unwrap();

    view! {
        <Show
            when=move || !data.is_loading.get()
            fallback=|| view! { <p class="pl-2">Loading...</p> }
        >
            <table class="table-auto w-full divide-y divide-x divide-gray-200">
                <thead class="sticky top-0 bg-white">
                    <tr class="bg-gray-100 hover:bg-gray-200 divide-x divide-gray-200">
                        <For
                            each=move || data.sql_result.get().unwrap().0
                            key=|n| n.clone()
                            let:col
                        >
                            <th class="text-xs px-4">{col}</th>
                        </For>
                    </tr>
                </thead>
                <tbody>
                    <For each=move || data.sql_result.get().unwrap().1 key=|n| n.clone() let:row>
                        <tr class="hover:bg-gray-100 divide-x divide-gray-200">
                            <For each=move || row.clone() key=|n| n.clone() let:cell>
                                <td class="px-4 text-xs cursor:pointer">{cell}</td>
                            </For>
                        </tr>
                    </For>
                </tbody>
            </table>
        </Show>
    }
}

