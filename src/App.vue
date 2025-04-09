<template>
  <div id="app">
    <!-- <el-button type="primary">这是一个Element Plus按钮</el-button> -->
    <CesiumViewer />
  </div>
</template>

<script>
import CesiumViewer from './components/CesiumViewer';

export default {
  name: 'App',
  components: {
    CesiumViewer
  }
};
</script>

<style>
#app {
  text-align: center;
}
</style>
