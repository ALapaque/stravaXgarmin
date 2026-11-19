<template>
  <div class="app app--nav">
    <AppAurora />
    <DemoBanner />
    <AppSidebar />
    <main class="screen">
      <slot />
    </main>
    <AppTabBar />
    <AppToast />
  </div>
</template>
