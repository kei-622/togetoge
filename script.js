import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

//  【重要】Firebaseの設定情報をここに貼り付けてください
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

// --- 画面切り替えの制御（イベントリスナー登録） ---

document.getElementById('btn-have-id').addEventListener('click', () => {
    switchScreen('step1-choice', 'step2a-input');
});

document.getElementById('btn-create-id').addEventListener('click', createNewGroup);

document.getElementById('btn-back-from-input').addEventListener('click', () => {
    switchScreen('step2a-input', 'step1-choice');
});

document.getElementById('btn-join').addEventListener('click', joinGroup);

document.getElementById('btn-enter-created').addEventListener('click', () => {
    switchScreen('step2b-share', 'mainContent');
});

document.getElementById('btn-copy').addEventListener('click', copyIdToClipboard);
document.getElementById('btn-vote-A').addEventListener('click', () => castVote('A'));
document.getElementById('btn-vote-B').addEventListener('click', () => castVote('B'));

function switchScreen(hideId, showId) {
    document.getElementById(hideId).classList.add('hidden');
    document.getElementById(showId).classList.remove('hidden');
}

// --- LINE共有リンクの作成 ---
function updateLineShareLink(groupId) {
    // 現在のページのURL（GitHub PagesのURLなど）を取得
    const currentUrl = window.location.href.split('?')[0];
    const inviteUrl = `${currentUrl}?room=${groupId}`;
    
    const lineText = encodeURIComponent(`旅行計画アプリ「旅プラ」の部屋が作成されました！\n以下のリンクから参加してね！\n${inviteUrl}`);
    document.getElementById('btn-line-share').href = `https://social-plugins.line.me/lineit/share?url=${lineText}`;
}

// コピペ機能
function copyIdToClipboard() {
    navigator.clipboard.writeText(currentGroupId);
    alert(`グループID [ ${currentGroupId} ] をコピーしました！`);
}

// --- Firebase 連携処理 ---

async function createNewGroup() {
    const randomId = "room-" + Math.floor(1000 + Math.random() * 9000);
    currentGroupId = randomId;

    const groupRef = doc(db, "travel_groups", randomId);
    await setDoc(groupRef, { members: [], votes: { A: 0, B: 0 } });

    document.getElementById('generatedIdDisplay').innerText = randomId;
    updateLineShareLink(randomId);
    enterRoom(randomId);
    
    switchScreen('step1-choice', 'step2b-share');
}

async function joinGroup() {
    const idInput = document.getElementById('inputGroupId').value.trim();
    if (!idInput) return alert("グループIDを入力してください");

    const groupRef = doc(db, "travel_groups", idInput);
    const docSnap = await getDoc(groupRef);

    if (docSnap.exists()) {
        enterRoom(idInput);
        switchScreen('step2a-input', 'mainContent');
    } else {
        alert("そのIDのグループは見つかりません。");
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

// ページを開いた瞬間にLINE招待リンク（?room=xxx）から来たかチェックする機能
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');
    if (roomIdFromUrl) {
        enterRoom(roomIdFromUrl);
        document.getElementById('step1-choice').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
    }
});

// --- データ送信・グラフ描画（前回と同様） ---

document.getElementById('surveyForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('userName').value;
    const budget = parseInt(document.getElementById('userBudget').value);
    const activity = document.getElementById('userActivity').value;

    await updateDoc(doc(db, "travel_groups", currentGroupId), {
        members: arrayUnion({ name, budget, activity })
    });
    document.getElementById('userName').value = '';
    alert("希望を送信しました！結果がリアルタイムに反映されます。");
});

async function castVote(plan) {
    const groupRef = doc(db, "travel_groups", currentGroupId);
    const docSnap = await getDoc(groupRef);
    const currentVotes = docSnap.data().votes || { A: 0, B: 0 };
    currentVotes[plan] = (currentVotes[plan] || 0) + 1;
    await updateDoc(groupRef, { votes: currentVotes });
}

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
