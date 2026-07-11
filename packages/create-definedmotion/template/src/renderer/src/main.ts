const isAutomation = new URLSearchParams(window.location.search).get('automation') === '1'

if (isAutomation) {
  const { runAutomation } = await import('./automation')
  await runAutomation()
} else {
  const { mount } = await import('svelte')
  const { default: App } = await import('./App.svelte')
  mount(App, {
    target: document.getElementById('app')!
  })
}
