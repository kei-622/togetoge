import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

//  Firebaseの設定情報をここに貼り付けてください
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentGroupId = "";
let budgetChartIdx = null;
let activityChartIdx = null;
let voteChartIdx = null;

//  【新機能】すべての画面を隠して、指定したステップだけを確実に表示する関数
function changePage(pageId) {
    document.querySelectorAll('.step-page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// --- ボタンをクリックしたときの動きを登録 ---

document.getElementById('btn-have-id').addEventListener('click', () => {
    changePage('page-step2a'); // ID入力画面へ
});

document.getElementById('btn-create-id').addEventListener('click', createNewGroup); // ID自動生成へ

document.getElementById('btn-back-from-input').addEventListener('click', () => {
    changePage('page-step1'); // 最初の画面に戻る
});

document.getElementById('btn-join').addEventListener('click', joinGroup);

document.getElementById('btn-enter-created').addEventListener('click', () => {
    changePage('page-main'); // メイン画面へ進む
});

document.getElementById('btn-copy').addEventListener('click', copyIdToClipboard);
document.getElementById('btn-vote-A').addEventListener('click', () => castVote('A'));
document.getElementById('btn-vote-B').addEventListener('click', () => castVote('B'));


// --- LINE共有リンクとコピペ機能 ---
function updateLineShareLink(groupId) {
    const currentUrl = window.location.href.split('?')[0];
    const inviteUrl = `${currentUrl}?room=${groupId}`;
    const lineText = encodeURIComponent(`グループ旅行計画「旅プラ」の部屋ができたよ！\nこのリンクから回答してね！\n${inviteUrl}`);
    document.getElementById('btn-line-share').href = `https://social-plugins.line.me/lineit/share?url=${lineText}`;
}

function copyIdToClipboard() {
    navigator.clipboard.writeText(currentGroupId);
    alert(`グループID [ ${currentGroupId} ] をコピーしました！友達に送ってあげてください。`);
}

// --- Firebase接続処理 ---

async function createNewGroup() {
    const randomId = "room-" + Math.floor(1000 + Math.random() * 9000);
    currentGroupId = randomId;

    const groupRef = doc(db, "travel_groups", randomId);
    await setDoc(groupRef, { members: [], votes: { A: 0, B: 0 } });

    document.getElementById('generatedIdDisplay').innerText = randomId;
    updateLineShareLink(randomId);
    enterRoom(randomId);
    
    changePage('page-step2b'); // 共有画面へ切り替え
}

async function joinGroup() {
    const idInput = document.getElementById('inputGroupId').value.trim();
    if (!idInput) return alert("グループIDを入力してください");

    const groupRef = doc(db, "travel_groups", idInput);
    const docSnap = await getDoc(groupRef);

    if (docSnap.exists()) {
        enterRoom(idInput);
        changePage('page-main'); // メイン画面へ切り替え
    } else {
        alert("そのIDのグループは見つかりません。番号が合っているか確認してください。");
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

// LINEのURLを踏んで直接入ってきた人の自動処理
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');
    if (roomIdFromUrl) {
        enterRoom(roomIdFromUrl);
        changePage('page-main');
    }
});

// --- データ集計フォーム送信 ---
document.getElementById('surveyForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('userName').value;
    const budget = parseInt(document.getElementById('userBudget').value);
    const activity = document.getElementById('userActivity').value;

    await updateDoc(doc(db, "travel_groups", currentGroupId), {
        members: arrayUnion({ name, budget, activity })
    });
    document.getElementById('userName').value = '';
    alert("希望を送信しました！みんなの画面がリアルタイムに更新されます。");
});

async function castVote(plan) {
    const groupRef = doc(db, "travel_groups", currentGroupId);
    const docSnap = await getDoc(groupRef);
    const currentVotes = docSnap.data().votes || { A: 0, B: 0 };
    currentVotes[plan] = (currentVotes[plan] || 0) + 1;
    await updateDoc(groupRef, { votes: currentVotes });
}

// --- グラフとテキストの描画 (Chart.js) ---
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
