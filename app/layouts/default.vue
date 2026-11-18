<template>
  <div class="app">
    <DemoBanner />
    <main class="screen">
      <slot />
    </main>
    <AppTabBar />
    <AppToast />
  </div>
</template>
