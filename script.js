// Firebase SDKの読み込み
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

//  【重要】授業用にFirebaseを準備したら、ここにあなたの設定情報を貼り付けます
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// アプリ内のグローバル変数
let currentGroupId = "";
let budgetChartIdx = null;
let activityChartIdx = null;
let voteChartIdx = null;

// --- グループ管理機能 ---

// 1. 新しいグループIDを自動生成して作成
window.createNewGroup = async function() {
    // 簡易的なランダムIDの生成 (例: room-4829)
    const randomId = "room-" + Math.floor(1000 + Math.random() * 9000);
    
    // データベースに初期構造を作って保存
    const groupRef = doc(db, "travel_groups", randomId);
    await setDoc(groupRef, {
        members: [],
        votes: { A: 0, B: 0 }
    });

    enterRoom(randomId);
}

// 2. 入力されたグループIDで既存の部屋に入る
window.joinGroup = async function() {
    const idInput = document.getElementById('inputGroupId').value.trim();
    if (!idInput) {
        alert("グループIDを入力してください");
        return;
    }

    // 存在する部屋か確認
    const groupRef = doc(db, "travel_groups", idInput);
    const docSnap = await getDoc(groupRef);

    if (docSnap.exists()) {
        enterRoom(idInput);
    } else {
        alert("該当するグループIDが見つかりません。IDが正しいか確認するか、新しく作成してください。");
    }
}

// 3. 画面の切り替えとリアルタイム監視の開始
function enterRoom(groupId) {
    currentGroupId = groupId;
    
    // 画面の表示切り替え
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('displayGroupId').innerText = groupId;

    //  Firebaseのデータベースをリアルタイム監視する（別端末の変更も1秒未満でここに反映される）
    onSnapshot(doc(db, "travel_groups", groupId), (doc) => {
        const data = doc.data();
        if (data) {
            updateCharts(data.members);
            updateProposals(data.members);
            updateVoteChart(data.votes);
        }
    });
}

// --- データ送信機能 ---

// 希望フォームの送信処理
document.getElementById('surveyForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('userName').value;
    const budget = parseInt(document.getElementById('userBudget').value);
    const activity = document.getElementById('userActivity').value;

    const groupRef = doc(db, "travel_groups", currentGroupId);
    
    // データベースの配列にメンバーデータを追加保存
    await updateDoc(groupRef, {
        members: arrayUnion({ name, budget, activity })
    });

    document.getElementById('userName').value = '';
    alert("回答を送信しました！");
});

// 投票処理
window.castVote = async function(plan) {
    const groupRef = doc(db, "travel_groups", currentGroupId);
    
    // 現在の票数を一度取得して、1プラスして更新
    const docSnap = await getDoc(groupRef);
    const currentVotes = docSnap.data().votes;
    currentVotes[plan] = (currentVotes[plan] || 0) + 1;

    await updateDoc(groupRef, { votes: currentVotes });
}

// --- グラフ・テキスト描画機能（前回のロジックとほぼ同じ） ---

function updateCharts(members) {
    if (!members || members.length === 0) return;
    
    const names = members.map(d => d.name);
    const budgets = members.map(d => d.budget);

    if (budgetChartIdx) budgetChartIdx.destroy();
    const ctxB = document.getElementById('budgetChart').getContext('2d');
    budgetChartIdx = new Chart(ctxB, {
        type: 'bar',
        data: {
            labels: names,
            datasets: [{ label: '予算 (円)', data: budgets, backgroundColor: '#3498db' }]
        },
        options: { responsive: true }
    });

    const activityCounts = {};
    members.forEach(d => {
        activityCounts[d.activity] = (activityCounts[d.activity] || 0) + 1;
    });

    if (activityChartIdx) activityChartIdx.destroy();
    const ctxA = document.getElementById('activityChart').getContext('2d');
    activityChartIdx = new Chart(ctxA, {
        type: 'doughnut',
        data: {
            labels: Object.keys(activityCounts),
            datasets: [{ data: Object.values(activityCounts), backgroundColor: ['#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6'] }]
        },
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
    const ctxV = document.getElementById('voteChart').getContext('2d');
    voteChartIdx = new Chart(ctxV, {
        type: 'pie',
        data: {
            labels: ['プランA', 'プランB'],
            datasets: [{ data: [votes.A, votes.B], backgroundColor: ['#2ecc71', '#3498db'] }]
        },
        options: { responsive: true }
    });
}
