<template>
  <div class="app">
    <AppAurora />
    <DemoBanner />
    <main class="screen">
      <slot />
    </main>
    <AppTabBar />
    <AppToast />
  </div>
</template>
