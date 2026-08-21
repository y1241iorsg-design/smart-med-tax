// GitHub Pages向け静的モック用のシードデータ。
// backend/data/*.py, backend/symptom_categories.py, backend/condition_catalog.py の内容を
// フロントエンド(TypeScript)側にそのまま移植したもの。ロジックの整合性を保つため、
// バックエンドを変更した場合はこのファイルも合わせて更新すること。

export type MockProductSeed = {
  jan_code: string;
  name: string;
  generic_name: string;
  efficacy: string;
  category: string;
  is_qualified: boolean;
  dosage: string;
  side_effects: string;
  precautions: string;
  pdf_url: string;
  price: number;
};

export const MOCK_PRODUCTS: MockProductSeed[] = [
  {
    jan_code: "4987117709559",
    name: "A解熱鎮痛薬 12錠",
    generic_name: "ロキソプロフェンナトリウム水和物",
    efficacy: "頭痛・歯痛・生理痛・発熱の緩和",
    category: "解熱鎮痛薬",
    is_qualified: true,
    dosage:
      "成人（15歳以上）は1回1錠を1日2回まで、なるべく空腹時を避けて水又はお湯で服用し、再度症状が出た場合は3回目を服用できるが、服用間隔は4時間以上あける。",
    side_effects:
      "胃部不快感、吐き気、発疹・かゆみなどがあらわれることがあり、まれにショック、皮膚粘膜眼症候群、肝機能障害等の重篤な症状が起こることがある。",
    precautions:
      "15歳未満や胃潰瘍・心臓病等の治療中の人は服用できず、服用中は他の解熱鎮痛薬・かぜ薬との併用や飲酒を避ける。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 780,
  },
  {
    jan_code: "4901301254115",
    name: "B解熱鎮痛薬 20錠",
    generic_name: "アスピリン・ダイアルミネート",
    efficacy: "頭痛・発熱・月経痛の緩和",
    category: "解熱鎮痛薬",
    is_qualified: true,
    dosage:
      "成人（15歳以上）は1回2錠を水又はぬるま湯で服用し、1日2回を限度として服用間隔は6時間以上あける。",
    side_effects:
      "発疹・発赤やかゆみ、吐き気・嘔吐、食欲不振、めまいなどがあらわれることがあり、まれにショックや皮膚粘膜眼症候群、肝機能障害等が起こることがある。",
    precautions:
      "15歳未満の小児や出産予定日12週以内の妊婦は服用できず、服用中は他の解熱鎮痛薬・かぜ薬・鎮静薬との併用を避ける。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 650,
  },
  {
    jan_code: "4904358020523",
    name: "C頭痛薬 40錠",
    generic_name: "イブプロフェン・酸化マグネシウム・無水カフェイン",
    efficacy: "頭痛・月経痛・発熱の緩和。胃への負担を軽減した処方",
    category: "解熱鎮痛薬",
    is_qualified: true,
    dosage:
      "成人（15歳以上）は1回2錠を1日2回を限度とし、なるべく空腹時を避けて服用し、服用間隔は6時間以上あける。",
    side_effects:
      "発疹・発赤、かゆみ、吐き気、胃部不快感などがあらわれることがあり、まれに重篤な胃腸障害や肝機能障害等が起こることがある。",
    precautions: "15歳未満は服用できず、服用前後の飲酒や他の解熱鎮痛薬・かぜ薬との併用は避ける。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 1280,
  },
  {
    jan_code: "4987107601063",
    name: "Dアレルギー薬 28錠",
    generic_name: "フェキソフェナジン塩酸塩",
    efficacy: "くしゃみ・鼻水・鼻づまり・目のかゆみの緩和。眠くなりにくい",
    category: "アレルギー専用鼻炎薬",
    is_qualified: true,
    dosage: "成人（15歳以上）は1回1錠を1日2回、朝夕に服用する。",
    side_effects:
      "口の渇き、便秘、下痢、眠気などがあらわれることがあり、まれにショックや肝機能障害、無顆粒球症等の重篤な症状が起こることがある。",
    precautions:
      "15歳未満は服用できず、他のアレルギー用薬や抗ヒスタミン剤を含む内服薬との併用は避け、妊婦は服用前に相談する。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 1480,
  },
  {
    jan_code: "4903301265031",
    name: "Eアレルギー薬 14錠",
    generic_name: "ロラタジン",
    efficacy: "花粉・ハウスダストによる鼻水・くしゃみ・目のかゆみの緩和。1日1回",
    category: "アレルギー専用鼻炎薬",
    is_qualified: true,
    dosage: "成人（15歳以上）は1回1錠を1日1回食後に、毎回同じ時間帯に服用する。",
    side_effects:
      "口の渇き、便秘、下痢、眠気などがあらわれることがあり、まれにショックや肝機能障害等の重篤な症状が起こることがある。",
    precautions: "15歳未満は服用できず、他のアレルギー用薬や抗ヒスタミン剤との併用、服用前後の飲酒は避ける。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 1280,
  },
  {
    jan_code: "4901427016041",
    name: "Fかぜ薬 30錠",
    generic_name: "総合感冒薬（マレイン酸クロルフェニラミン他）",
    efficacy: "鼻水・鼻づまり・のどの痛み・発熱・せきの緩和",
    category: "かぜ薬",
    is_qualified: true,
    dosage: "成人（15歳以上）は1回3錠を1日3回、食後なるべく30分以内に服用する（7歳未満は服用不可）。",
    side_effects:
      "便秘、口の渇き、眠気、目のかすみなどがあらわれることがあり、まれにショックや皮膚粘膜眼症候群、肝機能障害、ぜんそく等の重篤な症状が起こることがある。",
    precautions: "本剤の成分でアレルギーを起こしたことがある人は服用できず、服用後は乗物・機械類の運転操作を避け、長期連用しない。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 1680,
  },
  {
    jan_code: "4987317030034",
    name: "Gのど薬 18錠",
    generic_name: "トラネキサム酸・カルバゾクロム",
    efficacy: "のどの痛み・はれの緩和",
    category: "口腔・咽喉薬",
    is_qualified: true,
    dosage:
      "成人（15歳以上）は1回2錠を1日3回、朝昼晩に水又はお湯で服用する（7歳以上15歳未満は1回1錠）。",
    side_effects:
      "発疹・かゆみ、吐き気・嘔吐、めまい、頻尿などがあらわれることがあり、まれに脱力感や筋肉痛を伴う偽アルドステロン症等が起こることがある。",
    precautions: "甘草やグリチルリチン、トラネキサム酸を含む他の内服薬との併用は避け、長期連用しない。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 850,
  },
  {
    jan_code: "4901508025121",
    name: "Hのど薬スティック 16本",
    generic_name: "キキョウ末・キョウニン末・セネガ末・カンゾウ末（生薬）",
    efficacy: "せき・たん・のどの痛み・声がれの緩和。水なしで服用可",
    category: "口腔・咽喉薬",
    is_qualified: true,
    dosage: "成人（15歳以上）は1包を水なしでそのまま服用し、1日6回を限度として2時間以上の間隔をあける。",
    side_effects: "発疹・発赤、かゆみ、吐き気・嘔吐、食欲不振、めまいなどがあらわれることがある。",
    precautions: "3歳未満の乳幼児は服用できず、5〜6日服用しても症状が改善しない場合は医師等に相談する。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 700,
  },
  {
    jan_code: "4987028112014",
    name: "I胃腸薬 12錠",
    generic_name: "ファモチジン",
    efficacy: "胃痛・もたれ・胸やけ・むかつきの緩和",
    category: "胃腸薬",
    is_qualified: true,
    dosage:
      "成人（15歳以上80歳未満）は1回1錠を口中で溶かすか水又はお湯で服用し、1日2回まで、8時間以上の間隔をあける。",
    side_effects:
      "発疹・発赤やかゆみ、脈の乱れ、気分不良などがあらわれることがあり、まれにショックや皮膚粘膜眼症候群、肝機能障害、血液障害等の重篤な症状が起こることがある。",
    precautions:
      "ファモチジンにアレルギー歴のある人、80歳以上の高齢者、小児、妊婦は服用できず、他の胃腸薬との併用や2週間を超える連用は避ける。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 980,
  },
  {
    jan_code: "4987316034512",
    name: "J胃腸薬 60錠",
    generic_name: "メチルメチオニンスルホニウムクロリド（ビタミンU）・ビオジアスターゼ2000",
    efficacy: "胃もたれ・胃痛・食欲不振・消化不良の緩和",
    category: "胃腸薬",
    is_qualified: true,
    dosage: "成人（15歳以上）は1回2錠、8歳以上15歳未満は1回1錠を毎食後、1日3回水又は温湯で服用する。",
    side_effects: "まれに発疹・発赤やかゆみなどの皮膚症状があらわれることがある。",
    precautions: "8歳未満の小児は服用できず、授乳中の人は服用を避けるか授乳を避ける必要がある。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 900,
  },
  {
    jan_code: "4987123704748",
    name: "K下痢止め 12錠",
    generic_name: "ロペラミド塩酸塩",
    efficacy: "急性下痢・軟便・腹痛の緩和",
    category: "止瀉薬",
    is_qualified: true,
    dosage:
      "成人（15歳以上）は1回1錠を噛みくだくか口の中で溶かして服用し、1日3回を限度として4時間以上の間隔をあける。",
    side_effects: "発疹・発赤やかゆみ、頭痛、排尿困難、顔のほてりなどがあらわれることがある。",
    precautions: "15歳未満は服用できず、服用後は乗物や機械類の運転操作を避け、授乳中の人は服用を避けるか授乳を避ける。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 700,
  },
  {
    jan_code: "4901301312052",
    name: "L目薬 12ml",
    generic_name: "クロルフェニラミンマレイン酸塩",
    efficacy: "目のかゆみ・結膜充血・眼瞼炎・紫外線による眼炎の緩和",
    category: "アレルギー用点眼薬",
    is_qualified: true,
    dosage: "1回1〜3滴を1日5〜6回点眼する。",
    side_effects: "目のかすみ、充血の悪化、刺激感、かゆみなどがあらわれることがある。",
    precautions:
      "医師の治療を受けている人や緑内障の診断を受けたことのある人は使用前に相談し、5〜6日使用しても症状が改善しない場合は使用を中止して相談する。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 980,
  },
  {
    jan_code: "4987241137428",
    name: "M目薬 13ml",
    generic_name: "クロモグリク酸ナトリウム・マレイン酸クロルフェニラミン",
    efficacy: "目のかゆみ・充血・花粉症目のかゆみの緩和",
    category: "アレルギー用点眼薬",
    is_qualified: true,
    dosage: "1回1〜2滴を1日3〜6回点眼する。",
    side_effects: "目の充血、かゆみ、はれ、しみて痛いなどの症状があらわれることがある。",
    precautions:
      "医師の治療を受けている人や緑内障の診断を受けた人は使用前に相談し、5〜6日使用しても症状が改善しない場合は使用を中止して相談する。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 850,
  },
  {
    jan_code: "4903301100027",
    name: "Nビタミン剤 60錠",
    generic_name: "フルスルチアミン（ビタミンB1誘導体）・ビタミンB2・B6",
    efficacy: "肉体疲労・神経痛・肩こり・腰痛・眼精疲労の緩和",
    category: "ビタミン剤",
    is_qualified: true,
    dosage: "成人（15歳以上）は1回2〜3錠を1日1回、食後すぐに水又はお湯でかまずに服用する。",
    side_effects: "体質により胃部不快感や吐き気、軟便などの消化器症状があらわれることがある。",
    precautions: "用法・用量を厳守し、1ヵ月ほど服用しても症状が良くならない場合は医師等に相談する。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 2680,
  },
  {
    jan_code: "4901330030087",
    name: "Oビタミン剤 120錠",
    generic_name: "リボフラビン（ビタミンB2）・ビタミンB6・C",
    efficacy: "肌あれ・口内炎・にきび・疲れ目の緩和",
    category: "ビタミン剤",
    is_qualified: false,
    dosage: "成人（15歳以上）は1回1錠を1日2回、朝夕食後に水又はお湯で服用する。",
    side_effects:
      "胃部不快感や下痢などがあらわれることがあり、服用によりビタミンB2の影響で尿が黄色くなることがあるが心配はない。",
    precautions: "15歳未満は服用できず、1ヵ月ほど服用しても改善しない場合は医師等に相談する。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 1880,
  },
  {
    jan_code: "4903301069171",
    name: "ビタミンC 300錠",
    generic_name: "アスコルビン酸",
    efficacy: "ビタミンCの補給・疲れの緩和",
    category: "ビタミン剤",
    is_qualified: false,
    dosage: "15歳以上は1回1〜3錠を1日2回、食後に水又はお湯でかまずに服用する。",
    side_effects: "吐き気・嘔吐、胃部不快感、食欲不振、下痢などがあらわれることがある。",
    precautions: "定められた用法・用量を守り、症状が改善しない場合は医師、薬剤師又は登録販売者に相談する。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 850,
  },
  {
    jan_code: "4987103005217",
    name: "Qせき止め 30錠",
    generic_name: "ジヒドロコデインリン酸塩・dl-メチルエフェドリン塩酸塩",
    efficacy: "せき・たん・鼻水・鼻づまりの緩和",
    category: "鎮咳去痰薬",
    is_qualified: true,
    dosage: "成人（15歳以上）は1回4錠を1日3回、4時間以上の間隔をあけて水又はぬるま湯で服用する。",
    side_effects: "眠気やめまい、便秘などがあらわれることがあり、依存性のある成分を含むため長期・多量使用に注意が必要である。",
    precautions: "12歳未満は服用できず、服用後は乗物や機械類の運転操作を避け、飲酒と併用しない。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 880,
  },
  {
    jan_code: "4901301223487",
    name: "R皮膚薬 145g",
    generic_name: "クロタミトン・ジフェンヒドラミン塩酸塩・グリチルレチン酸",
    efficacy: "かゆみ・湿疹・かぶれ・皮膚炎・あせもの緩和",
    category: "皮膚薬",
    is_qualified: true,
    dosage: "1日数回、患部に適量を塗布する。",
    side_effects: "使用部位に発疹・発赤、かゆみ、はれなどがあらわれることがある。",
    precautions: "目や粘膜、傷口、ただれている部位には使用しない。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 1180,
  },
  {
    jan_code: "4903241004118",
    name: "S皮膚薬 15g",
    generic_name: "プレドニゾロン吉草酸エステル酢酸エステル・リドカイン",
    efficacy: "かゆみ・皮膚炎・湿疹・虫さされの緩和",
    category: "皮膚薬",
    is_qualified: true,
    dosage: "1日数回、適量を患部に塗布する。",
    side_effects: "発疹・発赤、かゆみ、はれ、かぶれ、刺激感などがあらわれることがある。",
    precautions: "5〜6日使用しても症状が改善しない場合は使用を中止し、医師等に相談する。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 780,
  },
  {
    jan_code: "4987045049025",
    name: "T睡眠改善薬 6錠",
    generic_name: "ジフェンヒドラミン塩酸塩",
    efficacy: "一時的な睡眠リズムの乱れによる不眠の緩和",
    category: "睡眠改善薬",
    is_qualified: true,
    dosage: "成人（15歳以上）は1回2錠を1日1回、就寝前に水又はぬるま湯で服用する。",
    side_effects: "眠気、悪心、頭痛、起床時の頭重感などがあらわれることがある。",
    precautions: "15歳未満は服用できず、就寝前以外は服用しない。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 880,
  },
  {
    jan_code: "4901207011345",
    name: "U女性保健薬 420錠",
    generic_name: "柴胡・当帰・川芎・地黄・芍薬など漢方13成分",
    efficacy: "更年期障害（ほてり・のぼせ・イライラ・動悸）・月経不順の緩和",
    category: "女性保健薬",
    is_qualified: true,
    dosage: "成人（15歳以上）は1回4錠を1日3回、毎食後に水又はお湯で服用する。",
    side_effects: "発疹・発赤、かゆみ、胃部不快感、食欲不振、吐き気・嘔吐などがあらわれることがある。",
    precautions: "15歳未満は服用できず、2〜3ヵ月服用しても症状が良くならない場合は医師等に相談する。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 4280,
  },
  {
    jan_code: "4901520059345",
    name: "V女性保健薬 30錠",
    generic_name: "チェストツリー乾燥エキス",
    efficacy: "月経前症候群・更年期の情緒不安定・乳房の張りの緩和",
    category: "女性保健薬",
    is_qualified: false,
    dosage: "成人女性（18歳以上）は1回1錠を1日1回、毎日決まった時間に服用する。",
    side_effects: "発疹・発赤やかゆみ、吐き気、下痢、月経異常などがあらわれることがある。",
    precautions: "18歳未満は服用できず、1ヵ月ほど服用しても症状が改善しない場合は医師等に相談する。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 2380,
  },
  {
    jan_code: "4901207012345",
    name: "W漢方薬 180錠",
    generic_name: "加味逍遥散（柴胡・芍薬・当帰・茯苓・白朮など）",
    efficacy: "更年期症状・肩こり・疲れ・冷え・のぼせ・不眠・不安の緩和",
    category: "漢方薬",
    is_qualified: true,
    dosage:
      "成人（15歳以上）は1回4錠を1日3回、食前又は食間に水又は白湯で服用する（5歳未満は服用不可）。",
    side_effects:
      "腹痛、下痢、発疹、食欲不振、悪心・嘔吐などがあらわれることがあり、まれに重篤な腸間膜静脈硬化症等が起こることがある。",
    precautions: "体質・症状に合わないと感じた場合は服用を中止し、医師、薬剤師又は登録販売者に相談する。",
    pdf_url: "https://www.pmda.go.jp/PmdaSearch/otcSearch/",
    price: 2780,
  },
];

// backend/data/vendor_mock.py の _CHANNELS / _search_url を移植
const CHANNELS: { storeName: string; channel: string; factor: number }[] = [
  { storeName: "楽天市場", channel: "rakuten", factor: 1.0 },
  { storeName: "Amazon.co.jp", channel: "amazon", factor: 0.97 },
  { storeName: "Yahoo!ショッピング", channel: "yahoo", factor: 1.03 },
];

function searchUrl(channel: string, janCode: string, productName: string): string {
  const q = encodeURIComponent(`${productName} ${janCode}`);
  if (channel === "rakuten") return `https://search.rakuten.co.jp/search/mall/${q}/`;
  if (channel === "amazon") return `https://www.amazon.co.jp/s?k=${encodeURIComponent(janCode)}`;
  if (channel === "yahoo") return `https://shopping.yahoo.co.jp/search?p=${q}`;
  return `https://www.google.com/search?q=${q}`;
}

export type MockVendorListing = {
  jan_code: string;
  store_name: string;
  price: number;
  in_stock: boolean;
  url: string;
};

export function generateVendorListings(products: MockProductSeed[]): MockVendorListing[] {
  const listings: MockVendorListing[] = [];
  for (const p of products) {
    const base = Math.max(100, Math.round(p.price));
    for (const { storeName, channel, factor } of CHANNELS) {
      const price = Math.max(100, Math.round((base * factor) / 10) * 10);
      listings.push({
        jan_code: p.jan_code,
        store_name: storeName,
        price,
        in_stock: true,
        url: searchUrl(channel, p.jan_code, p.name),
      });
    }
  }
  return listings;
}

// backend/data/rx_mock.py を移植
export type RxCatalogSeed = {
  code: string;
  name: string;
  generic_name: string;
  category: string;
};

export const RX_CATALOG: RxCatalogSeed[] = [
  { code: "RX-A", name: "Rx-A降圧薬", generic_name: "ダミー降圧成分A", category: "降圧薬" },
  { code: "RX-B", name: "Rx-B糖尿病薬", generic_name: "ダミー血糖成分B", category: "糖尿病薬" },
  { code: "RX-C", name: "Rx-C胃薬", generic_name: "ダミー胃酸抑制成分C", category: "消化器用薬" },
  { code: "RX-D", name: "Rx-D抗アレルギー薬", generic_name: "ダミー抗ヒスタミン成分D", category: "アレルギー用薬" },
  { code: "RX-E", name: "Rx-E睡眠薬", generic_name: "ダミー睡眠成分E", category: "睡眠薬" },
  { code: "RX-F", name: "Rx-F鎮痛薬", generic_name: "ダミー鎮痛成分F", category: "鎮痛薬" },
  { code: "RX-G", name: "Rx-G脂質異常症薬", generic_name: "ダミー脂質成分G", category: "脂質異常症薬" },
  { code: "RX-H", name: "Rx-H抗凝固薬", generic_name: "ダミー抗凝固成分H", category: "抗凝固薬" },
];

// backend/condition_catalog.py を移植
export const CONDITION_OPTIONS: string[] = [
  "高血圧",
  "糖尿病",
  "心臓病",
  "腎臓病",
  "肝臓病",
  "胃潰瘍・十二指腸潰瘍",
  "ぜんそく",
  "緑内障",
  "甲状腺疾患",
  "てんかん",
  "前立腺肥大",
  "花粉症・アレルギー性鼻炎",
  "アトピー・皮膚アレルギー",
  "妊娠中",
  "授乳中",
];

export const CONDITION_PRECAUTION_TERMS: Record<string, string[]> = {
  高血圧: ["高血圧", "血圧"],
  糖尿病: ["糖尿病"],
  心臓病: ["心臓", "心臓病"],
  腎臓病: ["腎臓", "腎"],
  肝臓病: ["肝臓", "肝"],
  "胃潰瘍・十二指腸潰瘍": ["胃潰瘍", "十二指腸潰瘍", "胃潰瘍・心臓病"],
  ぜんそく: ["ぜんそく", "喘息"],
  緑内障: ["緑内障"],
  甲状腺疾患: ["甲状腺"],
  てんかん: ["てんかん"],
  前立腺肥大: ["前立腺"],
  "花粉症・アレルギー性鼻炎": ["アレルギー"],
  "アトピー・皮膚アレルギー": ["アレルギー"],
  妊娠中: ["妊婦", "妊娠"],
  授乳中: ["授乳"],
};

export function matchingConditionLabels(precautions: string, conditions: string[]): string[] {
  const matched: string[] = [];
  for (const condition of conditions) {
    const terms = CONDITION_PRECAUTION_TERMS[condition] ?? [condition];
    if (terms.some((term) => precautions.includes(term))) {
      matched.push(condition);
    }
  }
  return matched;
}

// backend/symptom_categories.py を移植
export const CATEGORY_CHAT_TRIGGERS: Record<string, string[]> = {
  "頭痛・発熱": ["頭が痛い", "頭痛", "熱がある", "熱っぽい", "発熱", "ずきずき", "頭が重い"],
  "鼻水・鼻づまり": ["鼻水", "鼻づまり", "鼻がつまる", "くしゃみ"],
  のどの痛み: ["のどが痛い", "喉が痛い", "のどの痛み", "喉の痛み", "声がれ"],
  "胃・腸の不調": ["胃が痛い", "お腹が痛い", "腹痛", "下痢", "胃もたれ", "胸やけ", "気持ち悪い"],
  目のかゆみ: ["目がかゆい", "目のかゆみ", "目が充血"],
  "肩こり・疲れ": ["肩こり", "疲れが取れない", "だるい", "疲労"],
  "せき・たん": ["せきが出る", "咳が出る", "たんが絡む", "咳き込む"],
  肌トラブル: ["肌がかゆい", "湿疹", "かぶれ", "虫刺され", "あせも"],
  "睡眠・ストレス": ["眠れない", "不眠", "寝つきが悪い", "ストレス"],
  "更年期症状（ほてり・イライラ・動悸）": ["更年期", "ほてる", "のぼせる", "イライラする", "動悸がする"],
};

export const CATEGORY_PRODUCT_TERMS: Record<string, string[]> = {
  "頭痛・発熱": ["頭痛", "発熱"],
  "鼻水・鼻づまり": ["鼻水", "鼻づまり"],
  のどの痛み: ["のどの痛み"],
  "胃・腸の不調": ["胃", "下痢", "腹痛", "消化"],
  目のかゆみ: ["目のかゆみ"],
  "肩こり・疲れ": ["肩こり", "疲労", "疲れ"],
  "せき・たん": ["せき", "たん"],
  肌トラブル: ["かゆみ", "湿疹", "かぶれ", "皮膚炎", "あせも", "虫さされ", "肌あれ", "にきび"],
  "睡眠・ストレス": ["不眠", "睡眠", "不安"],
  "更年期症状（ほてり・イライラ・動悸）": [
    "更年期",
    "ほてり",
    "イライラ",
    "動悸",
    "のぼせ",
    "月経前症候群",
    "情緒不安定",
    "乳房の張り",
  ],
};

export const FILTER_KEYWORDS: Record<string, string[]> = {
  "漢方・ナチュラル系": ["漢方", "生薬", "逍遥", "チェストツリー", "キキョウ", "当帰", "柴胡"],
  "更年期・ホルモンケア向け": ["更年期", "チェストツリー", "当帰", "逍遥", "月経", "のぼせ"],
  眠くなりにくい: ["フェキソフェナジン", "ロラタジン", "エピナスチン", "ロキソプロフェン"],
  胃に優しい処方: ["酸化マグネシウム", "ビタミンU", "ファモチジン", "メチルメチオニン"],
};

export const SEVERE_KEYWORDS: string[] = [
  "息が苦しい",
  "息苦しい",
  "呼吸が苦しい",
  "意識がもうろう",
  "意識がない",
  "激しい胸の痛み",
  "胸が締め付けられる",
  "唇が紫",
  "けいれん",
  "高熱が3日以上",
  "40度以上の熱",
  "大量に出血",
  "立てないほどの痛み",
];

export const ESCALATION_MESSAGE =
  "症状の内容から、医療機関の受診をおすすめします。\n本サービスは診断を行うものではありません。できるだけ早めに医療機関にご相談ください。";

export const NON_DIAGNOSIS_DISCLAIMER =
  "添付文書に基づき、入力された症状の効能を持つ商品を表示しています。最終的な選択は薬剤師または登録販売者にご相談ください。";

export const CLARIFYING_QUESTION =
  "どのような症状ですか?(例:頭痛、鼻水・鼻づまり、のどの痛み、胃の不調 など)";

export const MEDS_QUESTION =
  "検索の参考に、普段から飲んでいる薬があれば教えてください（例: A解熱鎮痛薬）。なければ「なし」と入力してください。本サービスは診断を行うものではありません。";

export const NONE_MED_REPLIES = ["なし", "無い", "ない", "特になし", "ありません", "いいえ", "no"];

export function detectSevereSymptom(text: string): boolean {
  return SEVERE_KEYWORDS.some((kw) => text.includes(kw));
}

export function matchCategoriesFromText(text: string): string[] {
  const matched: string[] = [];
  for (const [category, triggers] of Object.entries(CATEGORY_CHAT_TRIGGERS)) {
    if (triggers.some((trigger) => text.includes(trigger))) {
      matched.push(category);
    }
  }
  return matched;
}

// backend/data/pharmacy_mock.py を移植
export const MOCK_PHARMACIES = [
  {
    name: "マツモトキヨシ 渋谷店",
    address: "東京都渋谷区道玄坂1-2-3",
    phone: "03-1234-5678",
    lat: 35.6595,
    lon: 139.7004,
    opening_hours: "9:00-21:00",
  },
  {
    name: "ウエルシア 渋谷道玄坂店",
    address: "東京都渋谷区道玄坂2-10-1",
    phone: "03-2345-6789",
    lat: 35.658,
    lon: 139.698,
    opening_hours: "24時間",
  },
  {
    name: "サンドラッグ 渋谷センター街店",
    address: "東京都渋谷区宇田川町15-1",
    phone: "03-3456-7890",
    lat: 35.661,
    lon: 139.702,
    opening_hours: "10:00-22:00",
  },
];

// backend/db.py の _seed_experts を移植
export const MOCK_EXPERTS = [
  { name: "田中 誠", title: "薬剤師", area: "渋谷区", rating: 4.8 },
  { name: "山田 花子", title: "登録販売者", area: "新宿区", rating: 4.6 },
  { name: "佐藤 健", title: "薬剤師", area: "港区", rating: 4.9 },
];

export const MOCK_EXPERT_SLOTS: Record<string, string[]> = {
  "田中 誠": ["今日 14:00", "今日 16:30", "明日 10:00"],
  "山田 花子": ["今日 15:00", "明日 11:00", "明日 13:00"],
  "佐藤 健": ["今日 17:00", "明日 09:30", "明日 14:00"],
};
