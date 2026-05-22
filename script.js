// アプリケーションの状態管理
let memberData = [];
let votes = { A: 0, B: 0 };

// グラフのインスタンスを保持する変数
let budgetChartIdx = null;
let activityChartIdx = null;
let voteChartIdx = null;

// フォーム送信時のイベント処理
document.getElementById('surveyForm').addEventListener('submit', function(e) {
    e.preventDefault(); // ページのリロードを防ぐ

    // 入力データの取得
    const name = document.getElementById('userName').value;
    const budget = parseInt(document.getElementById('userBudget').value);
    const activity = document.getElementById('userActivity').value;

    // データを配列に追加
    memberData.push({ name, budget, activity });

    // フォームをリセット
    document.getElementById('userName').value = '';
    
    // 画面の更新
    updateCharts();
    updateProposals();
});

// グラフを更新する関数
function updateCharts() {
    const names = memberData.map(d => d.name);
    const budgets = memberData.map(d => d.budget);

    // 1. 予算グラフの描画/更新
    if (budgetChartIdx) budgetChartIdx.destroy(); // 古いグラフを破棄
    const ctxB = document.getElementById('budgetChart').getContext('2d');
    budgetChartIdx = new Chart(ctxB, {
        type: 'bar',
        data: {
            labels: names,
            datasets: [{
                label: '予算 (円)',
                data: budgets,
                backgroundColor: '#3498db'
            }]
        },
        options: { responsive: true }
    });

    // 2. やりたいことの集計
    const activityCounts = {};
    memberData.forEach(d => {
        activityCounts[d.activity] = (activityCounts[d.activity] || 0) + 1;
    });

    if (activityChartIdx) activityChartIdx.destroy();
    const ctxA = document.getElementById('activityChart').getContext('2d');
    activityChartIdx = new Chart(ctxA, {
        type: 'doughnut',
        data: {
            labels: Object.keys(activityCounts),
            datasets: [{
                data: Object.values(activityCounts),
                backgroundColor: ['#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6']
            }]
        },
        options: { responsive: true }
    });
}

// データの変化に合わせて提案テキストを切り替える関数（AIのモック）
function updateProposals() {
    if (memberData.length === 0) return;

    // 平均予算の計算
    const avgBudget = memberData.reduce((sum, d) => sum + d.budget, 0) / memberData.length;

    // 簡単な条件分岐で提案内容を変化させる
    if (avgBudget < 20000) {
        document.getElementById('planADesc').innerText = `予算重視！近場で楽しむローカル日帰り観光ツアー（想定費用: 約${Math.round(avgBudget)}円）`;
        document.getElementById('planBDesc').innerText = `お家やレンタルスペースを借り切ってまったりパーティー（想定費用: 約${Math.round(avgBudget * 0.8)}円）`;
    } else {
        document.getElementById('planADesc').innerText = `ちょっと贅沢！話題のスポットを巡る1泊2日の温泉旅行（想定費用: 約${Math.round(avgBudget)}円）`;
        document.getElementById('planBDesc').innerText = `グランピング施設で大自然とリッチなBBQを堪能するプラン（想定費用: 約${Math.round(avgBudget * 0.9)}円）`;
    }
}

// 投票処理
function castVote(plan) {
    if (memberData.length === 0) {
        alert('まずは1人以上の希望を入力（送信）してください！');
        return;
    }
    votes[plan]++;
    updateVoteChart();
}

// 多数決グラフの更新
function updateVoteChart() {
    if (voteChartIdx) voteChartIdx.destroy();
    const ctxV = document.getElementById('voteChart').getContext('2d');
    voteChartIdx = new Chart(ctxV, {
        type: 'pie',
        data: {
            labels: ['プランA', 'プランB'],
            datasets: [{
                data: [votes.A, votes.B],
                backgroundColor: ['#2ecc71', '#3498db']
            }]
        },
        options: { responsive: true }
    });
}
