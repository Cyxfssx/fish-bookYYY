<template>
    <div class="container">
        <div class="logo">
            <img :src="logo" alt="fish-book" width="130" height="130" />
        </div>
        <h1 class="title">fish-book</h1>
        <div class="description">
            <p>本地小说阅读器 · 所有阅读功能均在本机运行</p>
            <el-divider></el-divider>
            <div class="shortDesc">
                <h4>阅读器 - 默认快捷键</h4>
                <ul>
                    <li>上一页：{{ shortcutSettings.key1 }}</li>
                    <li>下一页：{{ shortcutSettings.key2 }}</li>
                    <li>老板键：{{ shortcutSettings.key3 }}</li>
                </ul>
                <h4>
                    更多功能请点击左侧菜单
                    <span style="color: #008aff">配置</span>
                    按钮自行设置
                </h4>

            </div>
        </div>

    </div>
</template>

<script>
import logo from '../../public/images/logo.png';
import { shortcutSettings } from '../config/sysConfig';
export default {
    name: 'Home',
    data() {
        return {
            logo,
            shortcutSettings,
        };
    },

};
</script>

<style scoped lang="scss">
.container {
    background: #f5f5f5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 80vh;
    overflow: hidden;
    margin: 30px;
    border-radius: 20px;
    color: #333333;
}

.logo {
    margin-bottom: 0px;
}

.title {
    font-size: 2em;
    font-weight: normal;
    font-size: 40px;
    margin: 16px;
}

.description {
    max-width: 500px;
    text-align: center;
    font-size: 16px;
}
.shortDesc {
    text-align: center;
    letter-spacing: 2px;

    h4 {
        font-weight: normal;
    }
    ul,
    li {
        padding: 0;
        margin: 0;
    }
    li {
        color: #333;
        // font-weight: bold;
        text-transform: capitalize;
        list-style: none;
        line-height: 40px;
        font-family: Arial, Helvetica, sans-serif;
    }
}
</style>
