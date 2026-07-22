# -*- coding: utf-8 -*-
"""
v3: ストレス耐性・モチベーション・開放性の部分が、前の文章と噛み合わない
（唐突な「また、」で別の話題に飛ぶ／ポジティブな文の直後にネガティブな話が続く等）
問題を解消。8項目すべてを「強み（高い項目をまとめる1文）」と「懸念（低い項目を
まとめる1文）」の2つのグループに分けて、1つの筋の通った文章として組み立てる。

構成：
  [書き出し＋人との関わり方（1文）]
  [仕事の進め方（1文）]
  [強み一文：ストレス耐性・モチベーション・開放性のうち「高い」ものだけをまとめる。1つもなければ省略]
  [懸念一文：8項目すべてのうち「低い」ものをすべてまとめる。1つもなければ「頑張りすぎない」旨の一文]
"""
import csv
from itertools import product

TRAIT_ORDER_5 = ["主体性", "行動傾向", "協調性", "外向性", "勤勉性・計画性"]
TRAIT_ORDER_8 = TRAIT_ORDER_5 + ["ストレス耐性", "モチベーション", "開放性"]

# ---- 主体性×行動傾向：書き出し（動き方） ----
OPENING = {
    ("高い", "高い"): "自ら課題を見つけて動き出し、判断から行動までのスピードも速く、",
    ("高い", "低い"): "自ら課題を見つけて動きますが、リスクや状況をしっかり見極めてから動く慎重なタイプで、",
    ("低い", "高い"): "自分から方向性を決めるというより、周囲の状況や指示に反応して動くタイプで、",
    ("低い", "低い"): "自分から積極的に動くことは少なく、指示や状況を待ってから慎重に動くタイプで、",
}

# ---- 協調性×外向性：人との関わり方 ----
INTERPERSONAL = {
    ("高い", "高い"): "周囲との調和を大切にしながら、社交的に人を巻き込んで物事を進めていきます。",
    ("高い", "低い"): "周囲との調和を大切にしますが、前面に出るよりも裏方として静かに支えることを好みます。",
    ("低い", "高い"): "自分の考えを大切にする独立志向を持ちながら、社交的に自分の考えを発信していきます。",
    ("低い", "低い"): "周囲との調整よりも自分のペースを優先し、一人で抱え込みやすい面もあります。",
}

# ---- 勤勉性・計画性：仕事の進め方・向いている役割 ----
WORKSTYLE = {
    "高い": "計画的に段取りを組み立てるのが得意で、長期的な戦略づくりや着実な実行が求められる役割に向いています。",
    "低い": "計画よりもその場の状況に応じた柔軟さが持ち味ですが、段取りを事前に詰め切れないことがあります。",
}

# ---- 8項目共通：強み（高い場合）・懸念（低い場合）の一言 ----
# 主体性・行動傾向・協調性・外向性・勤勉性/計画性は書き出し等で既に触れているため、
# 「強み一文」には含めず、「懸念一文」にのみ使う（重複を避けるため）。
CONCERN_ORDER = TRAIT_ORDER_8  # 懸念は8項目すべてが対象
CONCERN_PHRASE = {
    "主体性": "指示や目標が曖昧だと動きにくくなること",
    "行動傾向": "スピードが求められる場面で出遅れやすいこと",
    "協調性": "周囲との連携が後回しになり孤立しやすいこと",
    "外向性": "自分の考えや成果を周囲に伝える機会が少ないこと",
    "勤勉性・計画性": "計画性やリスク管理が手薄になりやすいこと",
    "ストレス耐性": "プレッシャーがかかる場面で本来の力を発揮しにくくなりやすいこと",
    "モチベーション": "きっかけや目的が明確でないと意欲を保ちにくいこと",
    "開放性": "変化や新しいやり方への対応にはやや時間がかかること",
}
CAUTION_ALL_HIGH = "何事にも全力で取り組むタイプなので、頑張りすぎて息切れしないよう、適度に力を抜くことも意識すると長く活躍できます。"

# 強み一文の対象は、書き出し等でまだ触れていないストレス耐性・モチベーション・開放性のみ
STRENGTH_ORDER = ["ストレス耐性", "モチベーション", "開放性"]
STRENGTH_PHRASE = {
    "ストレス耐性": "プレッシャーの下でも動じず安定した力を発揮できる",
    "モチベーション": "自ら目標を高く持って意欲的に取り組める",
    "開放性": "新しいやり方やアイデアも積極的に取り入れられる",
}


def build_paragraph(values):
    opening = OPENING[(values["主体性"], values["行動傾向"])]
    interpersonal = INTERPERSONAL[(values["協調性"], values["外向性"])]
    workstyle = WORKSTYLE[values["勤勉性・計画性"]]

    high_strengths = [t for t in STRENGTH_ORDER if values[t] == "高い"]
    strength_sentence = ""
    if high_strengths:
        strength_sentence = "また、" + "、".join(STRENGTH_PHRASE[t] for t in high_strengths) + "点も強みです。"

    low_traits = [t for t in CONCERN_ORDER if values[t] == "低い"]
    if low_traits:
        concern_sentence = "一方で、" + "、".join(CONCERN_PHRASE[t] for t in low_traits) + "には注意が必要です。"
    else:
        concern_sentence = CAUTION_ALL_HIGH

    parts = [f"{opening}{interpersonal}", workstyle]
    if strength_sentence:
        parts.append(strength_sentence)
    parts.append(concern_sentence)
    return " ".join(parts)


def main():
    levels = ["高い", "低い"]
    rows = []
    for combo in product(levels, repeat=8):
        values = dict(zip(TRAIT_ORDER_8, combo))
        desc = build_paragraph(values)
        rows.append((values, desc))

    assert len(rows) == 256
    combos = set(tuple(v[t] for t in TRAIT_ORDER_8) for v, _ in rows)
    assert len(combos) == 256, len(combos)
    print("256 rows, all unique OK")

    import os
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "personality-types-256.csv")
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(TRAIT_ORDER_8 + ["説明"])
        for values, desc in rows:
            w.writerow([values[t] for t in TRAIT_ORDER_8] + [desc])
    print("wrote", out_path)

    # サンプル確認：全部高い／全部低い／混在（ポジティブ主体+ストレス耐性だけ低い）／
    # 混在（懸念ヘビー+強みも少しある）
    def find(pred):
        for values, desc in rows:
            if pred(values):
                return values, desc

    samples = [
        ("全部高い", lambda v: all(v[t] == "高い" for t in TRAIT_ORDER_8)),
        ("全部低い", lambda v: all(v[t] == "低い" for t in TRAIT_ORDER_8)),
        ("主体性系は全部高いがストレス耐性だけ低い", lambda v: all(v[t] == "高い" for t in TRAIT_ORDER_5) and v["ストレス耐性"] == "低い" and v["モチベーション"] == "高い" and v["開放性"] == "高い"),
        ("主体性系は全部低いがストレス耐性だけ高い", lambda v: all(v[t] == "低い" for t in TRAIT_ORDER_5) and v["ストレス耐性"] == "高い" and v["モチベーション"] == "低い" and v["開放性"] == "低い"),
    ]
    for label, pred in samples:
        v, d = find(pred)
        print(f"\n--- {label} ---")
        print(d)


if __name__ == "__main__":
    main()
