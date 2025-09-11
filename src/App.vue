<script setup lang="ts">
import { ElContainer, ElHeader, ElMain, ElMenu, ElMenuItem } from 'element-plus'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const menuList = [
  {
    name: '压测',
    path: '/load',
  },
  {
    name: '视频通话',
    path: '/video',
  },
  {
    name: '呼叫',
    path: '/outbound',
  },
  {
    name: 'SIPml5',
    path: '/sipml',
  },
]

const route = useRoute()
</script>

<template>
  <el-container>
    <el-header style="display: flex; align-items: center; gap: 16px">
      <strong>PBX 压测与视频通话 Demo</strong>
      <el-menu :default-active="route.path" mode="horizontal" router>
        <el-menu-item v-for="item in menuList" :key="item.path" :index="item.path">
          <router-link :to="item.path">{{ item.name }}</router-link>
        </el-menu-item>
      </el-menu>
    </el-header>
    <el-main>
      <RouterView />
    </el-main>
  </el-container>
</template>

<style scoped></style>
