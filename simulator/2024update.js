/**
 * ============================================================================
 * NMR スピンエコー・シミュレーター (アイソクロマット積算モデル)
 * 2026年度 卒業論文・研究発表用 最終バージョン
 * ============================================================================
 * * 【プログラムの物理的背景】
 * 本シミュレータは、ブロッホ方程式に基づく磁化ベクトルの振る舞いを記述します。
 * 特に、単純な数式近似（解析解）ではなく、以下の「アンサンブル積算手法」を採用することで、
 * スピンエコーの再収束プロセスを近似的に再現しています。
 * * 1. アイソクロマット（Isochromat）の概念:
 * サンプル内のスピンを、異なる共鳴周波数を持つ多数の小集（2000個）として扱います。
 * * 2. 緩和現象の物理的区別:
 * - T2 (真の横緩和): 時間経過とともに不可逆的に信号が減衰する効果。
 * - T2* (不均一性): スピンごとの周波数のバラつき（分布）として記述。
 * → ローレンツ分布に従う重み付けを行うことで再現。
 * * 3. エコーの形成原理:
 * 180度パルスによる位相の反転と、その後の位相の揃い（リフォーカス）を
 * 個々のスピンについて計算し、それらを足し合わせることでエコーを形成します。
 */

// ============================================
// 1.実験条件の設定
// ============================================
let params = {
    // 【オフセット周波数】実装上は Δf = Δω/2π を MHz で入力
    offset: 0.0,    
    
    // 【パルス幅/ 単位: µs】
    t_pulse1: 4.5,  
    t_pulse2: 9.0,  
    
    // 【磁気回転比 γ】[MHz/T]（核種で変える）
    // ※ここでの gamma は γ/(2π)（= gamma_bar）。位相計算で 2π を掛けて使う。
    gamma: 42.6,   
    
    // 【横緩和時間 (T2) / 単位: µs】
    T2: 100.0,      
    
    // 【tau】= 1stパルス中心 → 2ndパルス中心まで [µs]（パルス中心間隔）
    tau: 30.0       
};

// 初期設定の保存
const initialParams = { ...params };

// スライダーや計算エンジンを入れる変数
let sliders = {};
let mySim;

// ============================================
// 2. メイン処理 (p5.js の基本機能)
// ============================================

/** * setup(): プログラム開始時に1回だけ動く関数 
 * 画面を作ったり、スライダーを配置したりします。
 */
function setup() {
    new Canvas().create();      // 黒い画面を作る
    createInterface();          // スライダーを作る
    updateSimulation();         // 最初の計算と描画を行う
}

/** * updateSimulation(): 画面を更新する関数
 * スライダーを動かすたびに呼び出され、物理計算をやり直します。
 */
function updateSimulation() {
    background("#000000"); // 画面を黒でリセット

    // 1. スライダーの値を読み取って、パラメータ変数(params)を更新
    params.offset   = sliders.offset.value();
    params.t_pulse1 = sliders.t_pulse1.value();
    params.t_pulse2 = sliders.t_pulse2.value();
    params.gamma    = sliders.gamma.value();
    params.T2       = sliders.T2.value();
    params.tau      = sliders.tau.value();

    // 2. 右側の数値表示を更新
    drawLabels();

    // 3. ★物理エンジンの作成
    // ここで「2000個のスピン」が生成されます
    mySim = new BlochSimulator(params);
    
    // 4. グラフの枠線を描く
    let graph = new Graph();
    graph.create();

    // パルスの高さを計算（B1強度）
    const pulseMag = mySim.calculation_PulseMag();
    
    // 5. 緑色のパルスを描画
graph.drawPulse(pulseMag, params.t_pulse1, 0);  // 1本目
graph.drawPulse(pulseMag, params.t_pulse2, mySim.t2_start); // 2本目
    
    // 6. 白いNMR信号を描画（ここが計算のメイン結果）
    graph.drawSignal(mySim, params);
}

/** * draw(): アニメーションループ
 * 今回は静止画で十分なので、noLoop() で止めてPCの負荷を下げます。
 */
function draw() { noLoop(); }


// ============================================
// 3. UI (スライダー・ボタン) の作成
// ============================================
function createInterface() {
    let adj = new Adjuster();
    
    // スライダー作成: (ラベル, 最小, 最大, 初期値, ステップ, Y座標)
    
    // オフセット: -1.0〜+1.0 MHz
    sliders.offset = adj.makeSlider("Δ&omega;/2&pi;", -0.5, 0.5, params.offset, 0.05, 40);
    sliders.t_pulse1 = adj.makeSlider("t<sub>1st</sub>", 0.0, 10.0, params.t_pulse1, 0.1, 90);
    sliders.t_pulse2 = adj.makeSlider("t<sub>2nd</sub>", 0.0, 20.0, params.t_pulse2, 0.1, 140);
    sliders.gamma    = adj.makeSlider("&gamma;/2&pi;", 5.0, 50.0, params.gamma, 0.1, 190);
    sliders.T2       = adj.makeSlider("T<sub>2</sub>", 10.0, 300.0, params.T2, 5.0, 240);
    sliders.tau      = adj.makeSlider("&tau;", 16.0, 80.0, params.tau, 1.0, 290);

    // リセットボタン
    let resetBtn = createButton('Reset');
    resetBtn.position(adj.canvasWidth - 200, 350);
    resetBtn.style('width', '160px');
    resetBtn.style('padding', '5px');
    resetBtn.style('background-color', '#444');
    resetBtn.style('color', 'white');
    resetBtn.style('cursor', 'pointer');
    
    // ボタンが押されたら初期値に戻して再描画
    resetBtn.mousePressed(() => {
        Object.keys(sliders).forEach(key => sliders[key].value(initialParams[key]));
        updateSimulation();
    });
}

// 数値ラベルを描画する関数
function drawLabels() {
  let adj = new Adjuster(); 
  adj.drawValue(2 * Math.PI * params.offset, 40, " MHz");
  adj.drawValue(params.t_pulse1, 90, " µs");
  adj.drawValue(params.t_pulse2, 140, " µs");
  adj.drawValue(params.gamma, 190, " MHz/T");
  adj.drawValue(params.T2, 240, " µs");
  adj.drawValue(params.tau, 290, " µs");
}


// ============================================
// 4. ★物理シミュレーションクラス (ここが心臓部！)
// ============================================
class BlochSimulator {
    constructor(p) {
        // ---- 入力パラメータ ----
        this.offset   = p.offset;     // [MHz] = Δf = Δω/2π
        this.t_pulse1 = p.t_pulse1;   // [µs]
        this.t_pulse2 = p.t_pulse2;   // [µs]
        this.gamma    = p.gamma;      // [MHz/T]
        this.T2       = p.T2;         // [µs]
        this.tau      = p.tau;        // [µs] 1st center -> 2nd center
        
        // RF B_1 を固定
        // 例: 1H (γ=42.6 MHz/T) で 4.5 µs が90°になるように調整
        const GAMMA_REF = 42.6;   // [MHz/T]
        const T90_REF   = 4.5;    // [µs]
        // 2π * γ * B1 * t90 = π/2  =>  B1 = 1/(4γt90)
        this.B_1 = 1.0 / (4.0 * GAMMA_REF * T90_REF);  // [T]

        // ---- 磁場不均一性（装置側）を固定 ----
        this.delta_B_inhom = 7.5e-4;   // [T] 

        // ---- アイソクロマット集団 ----
        this.numSpins = 2000;
        this.spins = [];
        
        const range_B = 20.0 * this.delta_B_inhom;

        for (let i = 0; i < this.numSpins; i++) {
            // 各スピンの局所磁場ずれ [T]
            let dB_i = -range_B + (2 * range_B * i) / (this.numSpins - 1);

            // ローレンツ分布（磁場軸で重み付け）
            let weight = 1 / (1 + Math.pow(dB_i / this.delta_B_inhom, 2));

            this.spins.push({
                dB_i: dB_i,
                weight: weight
            });
        }

        this.totalWeight = this.spins.reduce((sum, s) => sum + s.weight, 0);

        // ---- 時刻定義（tau を「パルス中心間隔」として扱う）----
this.t1_center = this.t_pulse1 / 2;                  // 1stパルス中心
this.t1_end    = this.t_pulse1;                      // 1stパルス終了（描画の不感時間用）
this.t2_center = this.t1_center + this.tau;          // 2ndパルス中心（1st中心から tau 後）
this.t2_start  = this.t2_center - this.t_pulse2 / 2; // 2ndパルス開始
this.t_echo    = this.t1_center + 2 * this.tau;      // エコー中心（1st中心から 2tau 後）
    }

    getSignal(t) {
        if (t < this.t1_end) return 0;
        const tRel = t - this.t1_center;

        let theta1 = 2 * Math.PI * this.gamma * this.B_1 * this.t_pulse1;
        let theta2 = 2 * Math.PI * this.gamma * this.B_1 * this.t_pulse2;

        let currentPulseFactor;
        if (tRel < this.tau) {
  currentPulseFactor = Math.sin(theta1);
} else {
  currentPulseFactor = Math.sin(theta1) * Math.pow(Math.sin(theta2 / 2), 2);
}
        // 表示用スケール（絶対mV校正ではなく可視化用）
        let baseAmp = (5000 / Math.PI) * this.B_1 * currentPulseFactor;

const decay_T2 = Math.exp(-Math.max(0, tRel) / this.T2);

        let sumMx = 0;

        for (let i = 0; i < this.numSpins; i++) {
            let spin = this.spins[i];
            let total_f = this.offset + this.gamma * spin.dB_i;
            let phase = 0;

            if (tRel < this.tau) {
  // FID領域：phi = 2π f_i t'
  phase = 2 * Math.PI * total_f * (tRel);
} else {
  // Echo領域：phi = 2π f_i (t' - 2τ)
  phase = 2 * Math.PI * total_f * (tRel - 2 * this.tau);
}

            sumMx += spin.weight * Math.cos(phase);
        }

        return baseAmp * decay_T2 * (sumMx / this.totalWeight);
    }

    // パルスの高さ（表示用）
    calculation_PulseMag() {
        return 1700 * this.B_1;
    }
}


// ============================================
// 5. 描画・グラフ管理クラス
// ============================================
class Canvas {
    constructor() {
        this.canvasWidth = 750; 
        this.canvasHeight = 450;
        this.canvasBackGround = "#000000";
        this.marginLeft = 80;   
    }
    create() {
        createCanvas(this.canvasWidth, this.canvasHeight);
        background(this.canvasBackGround);
    }
}

class Adjuster extends Canvas {
    constructor() { super(); }
    
    // スライダーを作る関数
    makeSlider(labelHTML, min, max, val, step, yPos) {
//ラベル
    let lbl = createDiv(labelHTML);
    lbl.position(this.canvasWidth - 220, yPos);
    lbl.style('color', 'white');
    lbl.style('font-size', '14px');

    lbl.style('width', '160px');        // スライダー幅と同じに
    lbl.style('line-height', '1');      // 行の高さを詰める（重なり防止）
    lbl.style('pointer-events', 'none'); // クリック/ドラッグを邪魔しない

//スライダー
    let s = createSlider(min, max, val, step);
    s.position(this.canvasWidth - 220, yPos + 25); 
    s.style('width', '160px'); 
    s.input(updateSimulation); // 動かしたら即再計算
        return s;
    }

//値だけ描画する
drawValue(val, yPos, unit) {
  const xValue = this.canvasWidth - 20; // 右端寄せ
  textAlign(RIGHT, TOP);
  textSize(14);
  fill("#00ffff");
  noStroke();
  const displayVal = Number.isInteger(val) ? val + ".0" : val.toFixed(2);
  text(displayVal + unit, xValue, yPos + 12);
}
}

class Graph extends Canvas {
    constructor() {
        super();
        this.axisColor = "#aaaaaa"; 
        this.X_0 = this.marginLeft;
        this.Y_0 = this.canvasHeight / 3 * 2;
        this.GraphWidth = this.canvasWidth - 250;
        this.yScale = 90;
    }
    
    // グラフの軸と目盛りを描画
    create() {
        stroke(this.axisColor); strokeWeight(1);
        line(this.X_0, this.Y_0, this.GraphWidth, this.Y_0); // X軸
        line(this.X_0, 10, this.X_0, this.canvasHeight - 10); // Y軸
        
        fill(200); noStroke(); 
        textAlign(CENTER); textSize(11); 

        // グラフ縮尺の設定: 30ピクセル = 10マイクロ秒
        const pixelPerUnit = 30;
        const timePerUnit = 15;

        for (let i = 0; i < (this.GraphWidth - this.X_0) / pixelPerUnit; i++) {
            let x = this.X_0 + i * pixelPerUnit;
            let timeVal = i * timePerUnit; 
            
            stroke(100); 
            line(x, this.Y_0 - 5, x, this.Y_0 + 5);
            
            if (i % 2 == 0) {
                noStroke();
                text(timeVal, x, this.Y_0 + 20);
            }
        }
        textAlign(RIGHT); textSize(12); fill(255);
        text("Time [µs]", this.GraphWidth, this.Y_0 + 35);
        textAlign(LEFT); 
        text("Signal", 10, 20); 
    }
    
    // 緑色のパルスを描画
    drawPulse(mag, t_width, t_start) {
        stroke("#00ff00"); strokeWeight(2); 
        const timeToX = 30/15;
        let x = this.X_0 + t_start * timeToX;
        let w = t_width * timeToX;
        let h = mag * this.yScale;
        noFill();
        beginShape();
        vertex(x, this.Y_0);
        vertex(x, this.Y_0 - h);
        vertex(x + w, this.Y_0 - h);
        vertex(x + w, this.Y_0);
        endShape();
    }

    // 白い信号を描画
    drawSignal(sim, p) {
        stroke(255); strokeWeight(1.5);
        const timeToX = 30/15;
        let x_start = this.X_0 + p.t_pulse1 * timeToX;
        let x_end = this.GraphWidth;
        
        let prevX = x_start;
        let prevY = this.Y_0 - sim.getSignal(p.t_pulse1) * this.yScale;

        // 描画ループ: 2ピクセルごとに点を打って線を引く
        for (let x = x_start; x < x_end; x += 1) {
            let t = (x - this.X_0) / timeToX;
            
            // パルスが出ている間は、信号を見えなくする（実験装置の不感時間）
            let inPulse1 = (t >= 0 && t <= p.t_pulse1);

            const t2_start = sim.t2_start;
            const inPulse2 = (t >= t2_start && t <= t2_start + p.t_pulse2);

            if (!inPulse1 && !inPulse2) {
                let y = this.Y_0 - sim.getSignal(t) * this.yScale;
                line(prevX, prevY, x, y);
                prevX = x; prevY = y;
            } else {
                prevX = x;
                prevY = this.Y_0; 
            }
        }
    }
}