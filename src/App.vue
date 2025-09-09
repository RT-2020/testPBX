<script setup lang="ts">
import { ElContainer, ElHeader, ElMain, ElMenu, ElMenuItem } from 'element-plus'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <el-container>
    <el-header style="display: flex; align-items: center; gap: 16px">
      <strong>PBX 压测与视频通话 Demo</strong>
      <el-menu :default-active="route.path" mode="horizontal" router>
        <el-menu-item index="/load"><router-link to="/load">压测</router-link></el-menu-item>
        <el-menu-item index="/video"><router-link to="/video">视频通话</router-link></el-menu-item>
        <el-menu-item index="/outbound"
          ><router-link to="/outbound">呼叫</router-link></el-menu-item
        >
      </el-menu>
    </el-header>
    <el-main>
      <RouterView />
    </el-main>
  </el-container>
</template>

<style scoped></style>
