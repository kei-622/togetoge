import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---  1. 安全ガード付きのFirebase初期化エリア ---
let db = null;

//  あなたのFirebase設定をここに貼り付けてください
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

try {
    // もし設定が初期値のままでなければFirebaseを起動する
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } else {
        console.warn("Firebaseの設定情報がまだ書き換えられていません。初期画面の切り替えのみ動作します。");
    }
} catch (error) {
    console.error("Firebaseの初期化でエラーが発生しました:", error);
}


// ---  2. 画面切り替えシステム（ここからは何があっても絶対に動きます） ---
let currentGroupId = "";
let budgetChartIdx = null;
let activityChartIdx = null;
let voteChartIdx = null;

function changePage(pageId) {
    document.querySelectorAll('.step-page').forEach(page => {
        page.classList.remove('active');
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

// ページが読み込まれたらボタンの機能を絶対に登録する
window.addEventListener('DOMContentLoaded', () => {
    
    //  YES を押したとき
    document.getElementById('btn-have-id').addEventListener('click', () => {
        changePage('page-step2a');
    });

    //  NO を押したとき
    document.getElementById('btn-create-id').addEventListener('click', () => {
        if (!db) {
            alert(" Firebaseの設定（firebaseConfig）が正しく書き換えられていないため、IDの自動生成ができません。script.jsの7〜14行目を確認してください！");
            return;
        }
        createNewGroup();
    });

    // 入力画面から「戻る」を押したとき
    document.getElementById('btn-back-from-input').addEventListener('click', () => {
        changePage('page-step1');
    });

    // 入室ボタン・次へ進むボタン
    document.getElementById('btn-join').addEventListener('click', joinGroup);
    document.getElementById('btn-enter-created').addEventListener('click', () => {
        changePage('page-main');
    });

    // その他のボタン
    document.getElementById('btn-copy').addEventListener('click', copyIdToClipboard);
    document.getElementById('btn-vote-A').addEventListener('click', () => castVote('A'));
    document.getElementById('btn-vote-B').addEventListener('click', () => castVote('B'));

    // URLに直接ルームIDが入っていた場合の自動ログイン
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');
    if (roomIdFromUrl && db) {
        enterRoom(roomIdFromUrl);
        changePage('page-main');
    }
});


// ---  3. LINE共有・コピー機能 ---
function updateLineShareLink(groupId) {
    const currentUrl = window.location.href.split('?')[0];
    const inviteUrl = `${currentUrl}?room=${groupId}`;
    const lineText = encodeURIComponent(`グループ旅行計画「旅プラ」の部屋ができたよ！\nIDは [ ${groupId} ] です。\nこちらのリンクから直接参加してね！\n${inviteUrl}`);
    document.getElementById('btn-line-share').href = `https://social-plugins.line.me/lineit/share?url=${lineText}`;
}

function copyIdToClipboard() {
    navigator.clipboard.writeText(currentGroupId);
    alert(`こちらのID [ ${currentGroupId} ] をコピーしました！友達に送ってあげてください。`);
}


// ---  4. データベース（Firebase）通信処理 ---

async function createNewGroup() {
    try {
        const randomId = Math.floor(1000 + Math.random() * 9000).toString();
        currentGroupId = randomId;

        const groupRef = doc(db, "travel_groups", randomId);
        await setDoc(groupRef, { members: [], votes: { A: 0, B: 0 } });

        document.getElementById('generatedIdDisplay').innerText = randomId;
        updateLineShareLink(randomId);
        enterRoom(randomId);
        
        changePage('page-step2b');
    } catch (error) {
        alert(" グループ作成に失敗しました。\n理由: " + error.message);
    }
}

async function joinGroup() {
    if (!db) return alert("Firebaseが設定されていません");
    try {
        const idInput = document.getElementById('inputGroupId').value.trim();
        if (!idInput) return alert("グループIDを入力してください");

        const groupRef = doc(db, "travel_groups", idInput);
        const docSnap = await getDoc(groupRef);

        if (docSnap.exists()) {
            enterRoom(idInput);
            changePage('page-main');
        } else {
            alert("そのIDのグループは見つかりません。番号が合っているか確認してください。");
        }
    } catch (error) {
        alert(" 入室に失敗しました。\n理由: " + error.message);
    }
}

function enterRoom(groupId) {
    currentGroupId = groupId;
    document.getElementById('displayGroupId').innerText = groupId;

    onSnapshot(doc(db, "travel_groups", groupId), (doc) => {
        const data = doc.data();
        if (data) {
            updateCharts(data.members);
            updateProposals(data.members);
            updateVoteChart(data.votes);
        }
    });
}

// フォーム送信処理
document.getElementById('surveyForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!db) return;
    try {
        const name = document.getElementById('userName').value;
        const budget = parseInt(document.getElementById('userBudget').value);
        const activity = document.getElementById('userActivity').value;

        await updateDoc(doc(db, "travel_groups", currentGroupId), {
            members: arrayUnion({ name, budget, activity })
        });
        document.getElementById('userName').value = '';
        alert("希望を送信しました！みんなの画面がリアルタイムに更新されます。");
    } catch (error) {
        alert(" 送信に失敗しました。\n理由: " + error.message);
    }
});

async function castVote(plan) {
    if (!db) return;
    try {
        const groupRef = doc(db, "travel_groups", currentGroupId);
        const docSnap = await getDoc(groupRef);
        const currentVotes = docSnap.data().votes || { A: 0, B: 0 };
        currentVotes[plan] = (currentVotes[plan] || 0) + 1;
        await updateDoc(groupRef, { votes: currentVotes });
    } catch (error) {
        alert(" 投票に失敗しました。\n理由: " + error.message);
    }
}


// ---  5. グラフとテキストの描画 (Chart.js) ---
function updateCharts(members) {
    if (!members || members.length === 0) return;
    const names = members.map(d => d.name);
    const budgets = members.map(d => d.budget);

    if (budgetChartIdx) budgetChartIdx.destroy();
    budgetChartIdx = new Chart(document.getElementById('budgetChart').getContext('2d'), {
        type: 'bar',
        data: { labels: names, datasets: [{ label: '予算 (円)', data: budgets, backgroundColor: '#3498db' }] },
        options: { responsive: true }
    });

    const activityCounts = {};
    members.forEach(d => { activityCounts[d.activity] = (activityCounts[d.activity] || 0) + 1; });

    if (activityChartIdx) activityChartIdx.destroy();
    activityChartIdx = new Chart(document.getElementById('activityChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels: Object.keys(activityCounts), datasets: [{ data: Object.values(activityCounts), backgroundColor: ['#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6'] }] },
        options: { responsive: true }
    });
}

function updateProposals(members) {
    if (!members || members.length === 0) {
        document.getElementById('planADesc').innerText = "メンバーの入力を待っています...";
        document.getElementById('planBDesc').innerText = "メンバーの入力を待っています...";
        return;
    }
    const avgBudget = members.reduce((sum, d) => sum + d.budget, 0) / members.length;
    if (avgBudget < 20000) {
        document.getElementById('planADesc').innerText = `予算重視！近場で楽しむローカル日帰り観光ツアー（想定費用: 約${Math.round(avgBudget)}円）`;
        document.getElementById('planBDesc').innerText = `お家やレンタルスペースを借り切ってまったりパーティー（想定費用: 約${Math.round(avgBudget * 0.8)}円）`;
    } else {
        document.getElementById('planADesc').innerText = `ちょっと贅沢！話題のスポットを巡る1泊2日の温泉旅行（想定費用: 約${Math.round(avgBudget)}円）`;
        document.getElementById('planBDesc').innerText = `グランピング施設で大自然とリッチなBBQを堪能するプラン（想定費用: 約${Math.round(avgBudget * 0.9)}円）`;
    }
}

function updateVoteChart(votes) {
    if (!votes) return;
    if (voteChartIdx) voteChartIdx.destroy();
    voteChartIdx = new Chart(document.getElementById('voteChart').getContext('2d'), {
        type: 'pie',
        data: { labels: ['プランA', 'プランB'], datasets: [{ data: [votes.A, votes.B], backgroundColor: ['#2ecc71', '#3498db'] }] },
        options: { responsive: true }
    });
}
