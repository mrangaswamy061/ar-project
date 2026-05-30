const fetch = require('node-fetch');
async function run() {
    const res = await fetch('https://ar-project-dusky-seven.vercel.app/api/navigation-config');
    console.log(res.status);
    console.log(await res.text());
}
run();
