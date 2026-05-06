import type { Connection, PlanPoint, RoomData } from './types';

// ============ ROOM DATA ============
export const ROOMS: RoomData[] = [
  { name:'大厅', sub:'The Grand Hall', w:14, h:5, d:10,
    wallColor:0x1a1a1a, sideColor:0x141414, floorColor:0x111110,
    accent:[0.67,0.6,0.35],
    layout:[
      {wall:'back', x:-4.5, y:2.2, photo:0},
      {wall:'back', x:4.5,  y:2.2, photo:1},
      {wall:'left', z:-3,   y:2.2, photo:2},
      {wall:'right',z:-3,   y:2.2, photo:3},
    ],
    photos:[
      {t:'序·光',d:'每一束光都是一个入口',h:40,s:30},
      {t:'序·影',d:'影子是光的另一半',h:220,s:25},
      {t:'序·声',d:'寂静中听见心跳',h:0,s:5},
      {t:'序·色',d:'万物始于第一笔色彩',h:30,s:50},
    ]
  },
  { name:'自然之境', sub:"Nature's Whisper", w:12, h:5, d:10,
    wallColor:0x162016, sideColor:0x111a11, floorColor:0x0e120c,
    accent:[0.29,0.54,0.29],
    layout:[
      {wall:'back', x:-3,   y:2.2, photo:0},
      {wall:'right',z:3.5,  y:2.4, photo:1},
      {wall:'back', x:3,    y:2.2, photo:2},
      {wall:'left', z:-2,   y:2.2, photo:3},
      {wall:'left', z:2,    y:2.4, photo:4},
      {wall:'front',x:0,    y:2.2, photo:5},
    ],
    photos:[
      {t:'晨雾森林',d:'清晨的第一缕阳光穿透薄雾',h:120,s:60},
      {t:'碧海潮生',d:'潮汐带来了远方的故事',h:200,s:65},
      {t:'山巅之雪',d:'云海之上，万籁俱寂',h:210,s:40},
      {t:'秋叶之舞',d:'每一片落叶都是一个轮回',h:30,s:70},
      {t:'星空原野',d:'银河倾泻在无垠的草原',h:240,s:55},
      {t:'雨后彩虹',d:'风雨过后的第一道光',h:340,s:60},
    ]
  },
  { name:'都市光影', sub:'Urban Shadows', w:13, h:5, d:10,
    wallColor:0x161620, sideColor:0x101018, floorColor:0x0c0c12,
    accent:[0.42,0.42,0.67],
    layout:[
      {wall:'back', x:-3,   y:2.2, photo:0},
      {wall:'left', z:-3.2, y:2.2, photo:1},
      {wall:'front',x:3,    y:2.4, photo:2},
      {wall:'right',z:-2.5, y:2.2, photo:3},
      {wall:'right',z:1,    y:2.4, photo:4},
      {wall:'right',z:3.5,  y:2.2, photo:5},
    ],
    photos:[
      {t:'霓虹夜色',d:'城市的脉搏在午夜跳动',h:280,s:70},
      {t:'钢铁森林',d:'玻璃幕墙反射着千万个自己',h:200,s:50},
      {t:'地铁人潮',d:'每天数百万次擦肩而过',h:30,s:60},
      {t:'天台日落',d:'在城市的最高处看最后一抹余晖',h:15,s:75},
      {t:'雨中街头',d:'伞下的世界各自独立',h:220,s:45},
      {t:'建筑几何',d:'直线与曲线的交响乐',h:180,s:40},
    ]
  },
  { name:'人间烟火', sub:'Life & Soul', w:11, h:5, d:9,
    wallColor:0x201616, sideColor:0x181010, floorColor:0x120c0c,
    accent:[0.67,0.42,0.29],
    layout:[
      {wall:'back', x:-3,   y:2, photo:0},
      {wall:'back', x:3,    y:2, photo:1},
      {wall:'left', z:-1.5, y:2, photo:2},
      {wall:'left', z:1.5,  y:2, photo:3},
      {wall:'right',z:-3.2, y:2, photo:4},
      {wall:'right',z:3.2,  y:2, photo:5},
    ],
    photos:[
      {t:'老街茶馆',d:'一壶茶，一下午',h:30,s:50},
      {t:'市集清晨',d:'叫卖声中藏着生活的真味',h:45,s:65},
      {t:'孩童嬉戏',d:'笑声是最好的背景音乐',h:60,s:60},
      {t:'手艺人',d:'指尖上的时间沉淀',h:20,s:55},
      {t:'节日灯火',d:'万家灯火，温暖如初',h:350,s:70},
      {t:'归途',d:'每一步都是回家的方向',h:15,s:45},
    ]
  },
  { name:'时光回廊', sub:'Corridor of Time', w:10, h:5, d:14,
    wallColor:0x181816, sideColor:0x121210, floorColor:0x10100e,
    accent:[0.67,0.54,0.35],
    layout:[
      {wall:'left', z:-4,   y:2.2, photo:0},
      {wall:'left', z:0,    y:2.4, photo:1},
      {wall:'back', x:0,    y:2.2, photo:2},
      {wall:'right',z:-4,   y:2.4, photo:3},
      {wall:'right',z:0,    y:2.2, photo:4},
      {wall:'right',z:4,    y:2.4, photo:5},
    ],
    photos:[
      {t:'胶片记忆',d:'颗粒感是最温柔的滤镜',h:40,s:40},
      {t:'旧物新生',d:'每道划痕都是一段故事',h:25,s:45},
      {t:'黑白年代',d:'没有色彩反而更真实',h:0,s:5},
      {t:'泛黄书页',d:'字里行间藏着前人的温度',h:45,s:35},
      {t:'老式收音机',d:'调频之间的电流声',h:30,s:30},
      {t:'钟摆',d:'滴答声是时间的呼吸',h:0,s:10},
    ]
  }
];

export const ROOM_PLAN: PlanPoint[] = [
  {x:0,   z:-5},
  {x:-17, z:-5},
  {x:17,  z:-5},
  {x:0,   z:-17.5},
  {x:13,  z:-22.5},
];

export const CONNECTIONS: Connection[] = [
  {a:0, b:1, sideA:'left',  sideB:'right', offsetA:0, offsetB:0},
  {a:0, b:2, sideA:'right', sideB:'left',  offsetA:0, offsetB:0},
  {a:0, b:3, sideA:'back',  sideB:'front', offsetA:0, offsetB:0},
  {a:3, b:4, sideA:'right', sideB:'left',  offsetA:0, offsetB:5},
];
