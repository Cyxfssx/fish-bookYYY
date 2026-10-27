<template>
    <div class="about-us">
        <header>
            <h1>ABOUT SOFTWARE</h1>
        </header>
        <main>
            <p>本地小说阅读器：书籍、阅读进度和设置均保存在本机。</p>
            <p>无需账号或联网即可使用。</p>
        </main>
    </div>
</template>

<script>
export default { name: 'About' };
</script>

<style scoped lang="scss">
.about-us {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 60vh;
    span {
        user-select: all;
    }
}
header {
    text-align: center;
}
h1 {
    font-size: 2.5rem;
    margin: 0;
    color: #007bff;
}
main {
    padding: 20px;
    text-align: center;
}
a {
    color: #007bff;
    text-decoration: none;
    border-bottom: 1px solid #007bff;
}
a:hover {
    text-decoration: none;
    border-color: transparent;
}
</style>
