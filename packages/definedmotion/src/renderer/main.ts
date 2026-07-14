const parameters = new URLSearchParams(window.location.search)
const isAutomation = parameters.get('automation') === '1' || parameters.get('session') === '1'

if (isAutomation) {
  const { runAutomation } = await import('../automation/run')
  await runAutomation()
} else {
  const { mount } = await import('svelte')
  const { default: App } = await import('./App.svelte')
  mount(App, {
    target: document.getElementById('app')!
  })
}
