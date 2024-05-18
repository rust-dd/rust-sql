use leptos::*;

#[component]
pub fn Dashboard() -> impl IntoView {
  view! {
      <Tabs value=tabs.selected_tab>
          <For
              each=move || (0..tabs.active_tabs.get())
              key=|index| index.to_string()
              children=move |index| {
                  view! {
                      <div>
                          <Tab key=index.to_string()>
                              <TabLabel slot>
                                  <div class="flex flex-row items-center justify-between gap-2 h-full text-sm">
                                      <span>{format!("Tab {}", index + 1)}</span>
                                      <button
                                          class="rounded-full p-1 hover:bg-gray-100"
                                          on:click=move |_| { tabs.remove_editor(index) }
                                      >

                                          <Icon icon=icondata::CgClose width="16" height="16"/>
                                      </button>
                                  </div>
                              </TabLabel>
                              <QueryEditor/>
                              <QueryTable/>
                          </Tab>
                          <Button
                              size=ButtonSize::Small
                              icon=icondata::TbPlus
                              class="absolute top-2 right-2 text-sm"
                              on:click=move |_| {
                                  tabs.active_tabs.update(|prev| *prev += 1);
                                  tabs.selected_tab
                                      .update(|prev| {
                                          *prev = if *prev == "0" {
                                              "1".to_string()
                                          } else {
                                              (tabs.active_tabs.get() - 1).to_string()
                                          }
                                      });
                              }
                          >

                              {"Add Tab"}
                          </Button>
                      </div>
                  }
              }
          />

      </Tabs>
  }
}

