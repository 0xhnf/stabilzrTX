require('dotenv').config();
const { ethers } = require('ethers');
const readline = require('readline/promises');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const CONTRACT_INTERAKSI = '0xFa6419a3d3503a016dF3A59F690734862CA2A78D'; 

const TOKENS = {
    USDT: '0xee0418Bd560613fbcF924C36235AB1ec301D4933',
    USDC: '0x77ef087024F87976aAdA0Aa7F73BB8EAe6E9dda1',
    USDZ: '0x55Cc481D28Db3f1ffc9347745AA6fbB940505BdD',
    USDS: '0xF85938e2Bfc178026f60c5Ea50cC347D42C73b3D'
};

const erc20Abi = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint256)"
];

const swapAbi = [
    "function swap(address _from, address _to, uint256 _fromAmount, uint256 _toAmount) external"
];

const swapContract = new ethers.Contract(CONTRACT_INTERAKSI, swapAbi, wallet);

// ?? RANDOM AMOUNT
const pilihanRandomAmount = [500, 600, 700, 800, 900, 1000, 1200, 1500, 1800, 2000];

// ?? DELAY
const delayAcak = async (min, max) => {
    const d = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`[i] Delay ${d} detik`);
    return new Promise(res => setTimeout(res, d * 1000));
};

// ?? GET SALDO NUMBER
async function getSaldoNumber(tokenAddress) {
    const contract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
    const saldo = await contract.balanceOf(wallet.address);
    return parseFloat(ethers.formatUnits(saldo, 18));
}

// ?? TAMPILKAN SALDO
async function tampilkanSemuaSaldo() {
    console.log("\n=== SALDO TOKEN ===");

    for (const [nama, alamat] of Object.entries(TOKENS)) {
        const saldo = await getSaldoNumber(alamat);
        console.log(`> ${nama}: ${saldo}`);
    }

    console.log("====================\n");
}

// ?? RANDOM ROUTE FULL
function generateRuteUSDZRandom() {
    const tokens = [TOKENS.USDT, TOKENS.USDC, TOKENS.USDS];

    for (let i = tokens.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tokens[i], tokens[j]] = [tokens[j], tokens[i]];
    }

    let r = [];
    tokens.forEach(t => {
        r.push(t);
        r.push(TOKENS.USDZ);
    });

    return r;
}

// ?? RANDOM ROUTE TANPA USDS
function generateRuteUSDZRandomNoUSDS() {
    const tokens = [TOKENS.USDT, TOKENS.USDC];

    for (let i = tokens.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tokens[i], tokens[j]] = [tokens[j], tokens[i]];
    }

    let r = [];
    tokens.forEach(t => {
        r.push(t);
        r.push(TOKENS.USDZ);
    });

    return r;
}

// ?? SWAP
async function eksekusiSwap(tokenFrom, tokenTo, amountNum) {
    try {
        const token = new ethers.Contract(tokenFrom, erc20Abi, wallet);

        const amount = ethers.parseUnits(amountNum.toString(), 18);
        const minOut = ethers.parseUnits((amountNum * 0.99).toString(), 18);

        const saldo = await token.balanceOf(wallet.address);

        if (saldo < amount) {
            console.log(`[!] Saldo tidak cukup (${ethers.formatUnits(saldo, 18)})`);
            return false;
        }

        console.log("-> Approve...");
        await (await token.approve(CONTRACT_INTERAKSI, amount)).wait();

        console.log("-> Swap...");
        const tx = await swapContract.swap(tokenFrom, tokenTo, amount, minOut);
        await tx.wait();

        console.log(`? https://sepolia.etherscan.io/tx/${tx.hash}`);
        return true;

    } catch (e) {
        console.log("? ERROR:", e.reason || e.message);
        return false;
    }
}

// ?? MAIN
async function jalankanBot() {

    await tampilkanSemuaSaldo();

    console.log(`
Pilih Mode:
1. Fixed USDZ Loop
2. Smart Random USDZ
3. USDT <-> USDZ
4. USDS <-> USDZ
5. USDC <-> USDZ
6. Smart Random USDZ (No USDS)
`);

    let mode = await rl.question("Pilih: ");
    let inputJumlah = await rl.question("Jumlah (angka/random/max): ");
    let putaran = parseInt(await rl.question("Jumlah putaran: "));

    if (isNaN(putaran) || putaran < 1) putaran = 1;

    rl.close();

    console.log(`\n=== START ${putaran} PUTARAN ===`);

    for (let p = 1; p <= putaran; p++) {

        console.log(`\n--- PUTARAN ${p} ---`);
        await tampilkanSemuaSaldo();

        let route;

        if (mode === '1') {
            route = [
                TOKENS.USDT, TOKENS.USDZ,
                TOKENS.USDC, TOKENS.USDZ,
                TOKENS.USDS, TOKENS.USDZ
            ];
        } else if (mode === '2') {
            route = generateRuteUSDZRandom();
        } else if (mode === '3') {
            route = [TOKENS.USDT, TOKENS.USDZ];
        } else if (mode === '4') {
            route = [TOKENS.USDS, TOKENS.USDZ];
        } else if (mode === '5') {
            route = [TOKENS.USDC, TOKENS.USDZ];
        } else if (mode === '6') {
            route = generateRuteUSDZRandomNoUSDS();
        } else {
            console.log("Mode tidak valid");
            return;
        }

        for (let i = 0; i < route.length; i++) {

            const from = route[i];
            const to = route[(i + 1) % route.length];

            const namaFrom = Object.keys(TOKENS).find(k => TOKENS[k] === from);
            const namaTo = Object.keys(TOKENS).find(k => TOKENS[k] === to);

            let amount;

            if (inputJumlah.toLowerCase() === 'random') {
                const idx = Math.floor(Math.random() * pilihanRandomAmount.length);
                amount = pilihanRandomAmount[idx];

            } else if (inputJumlah.toLowerCase() === 'max') {

                const saldoNow = await getSaldoNumber(from);

                if (saldoNow < 1) {
                    console.log("[!] Saldo terlalu kecil, skip...");
                    await delayAcak(1,1);
                    continue;
                }

                amount = Math.floor(saldoNow); // ?? 100% saldo

            } else {
                amount = parseFloat(inputJumlah);

                if (isNaN(amount)) {
                    console.log("[!] input salah");
                    await delayAcak(1,1);
                    continue;
                }
            }

            console.log(`[+] ${namaFrom} -> ${namaTo} | ${amount}`);

            const ok = await eksekusiSwap(from, to, amount);

            if (!ok) {
                console.log("[!] skip cepat");
                await delayAcak(1,1);
                continue;
            }

            await delayAcak(300,500);
        }
    }

    console.log("\n? DONE");
}

jalankanBot();
