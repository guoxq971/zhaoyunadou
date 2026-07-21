// 由 scripts/build-game-pack-module.mjs 生成；请修改 JSON Manifest 后重新生成。
export const manifests = {
  "game": {
    "$schema": "./schemas/game.schema.json",
    "schemaVersion": "1.0.0",
    "id": "zhaoyun-adou",
    "title": "赵云与阿斗",
    "gameVersion": "1.0.0",
    "ruleset": {
      "id": "merge-defense",
      "version": "1.0.0"
    },
    "contentVersion": "1.0.0",
    "presentationVersion": "1.0.0",
    "locale": "zh-CN",
    "entryScene": "title",
    "targetPlatforms": [
      "web"
    ],
    "canvas": {
      "w": 420,
      "h": 760
    },
    "board": {
      "cols": 8,
      "rows": 10,
      "cell": 40,
      "cellW": 43,
      "cellH": 43,
      "ox": 38,
      "oy": 96
    },
    "benchSize": 5,
    "starterUnits": [
      "qiang",
      "gong",
      "dao"
    ],
    "initialResources": {
      "mantou": 40,
      "lives": 6,
      "shovels": 1,
      "brushes": 1
    },
    "storage": {
      "progressKey": "zyad_cleared_stars",
      "bestWaveKey": "zyad_best",
      "e2ePrefix": "zyad-e2e"
    },
    "manifestRefs": {
      "balance": "balance.json",
      "levels": "levels.json",
      "copy": "copy.zh-CN.json",
      "theme": "theme.json",
      "assets": "assets.json",
      "audio": "audio.json",
      "events": "events.json"
    }
  },
  "balance": {
    "$schema": "./schemas/balance.schema.json",
    "schemaVersion": "1.0.0",
    "version": "1.0.0",
    "recruitCost": {
      "base": 16,
      "linear": 3,
      "quadratic": 1
    },
    "gachaWeights": [
      {
        "kind": "troop",
        "type": "dao",
        "w": 21
      },
      {
        "kind": "troop",
        "type": "qiang",
        "w": 21
      },
      {
        "kind": "troop",
        "type": "gong",
        "w": 21
      },
      {
        "kind": "troop",
        "type": "qi",
        "w": 21
      },
      {
        "kind": "frag",
        "w": 10
      },
      {
        "kind": "troop",
        "type": "nong",
        "w": 4
      },
      {
        "kind": "shovel",
        "itemId": "shovel",
        "w": 2
      }
    ],
    "gachaPairing": {
      "categoryBoost": 3,
      "partnerBoost": 6
    },
    "troops": {
      "dao": {
        "char": "刀",
        "dmg": 6,
        "cd": 0.55,
        "range": 1.35,
        "behaviorId": "unit.melee",
        "renderId": "troop.dao"
      },
      "qiang": {
        "char": "枪",
        "dmg": 10,
        "cd": 0.9,
        "range": 2.3,
        "behaviorId": "unit.melee",
        "renderId": "troop.qiang"
      },
      "gong": {
        "char": "弓",
        "dmg": 7,
        "cd": 1.05,
        "range": 3.8,
        "projectile": true,
        "projectileSpeed": 380,
        "behaviorId": "unit.projectile",
        "renderId": "troop.gong"
      },
      "qi": {
        "char": "骑",
        "dmg": 16,
        "cd": 1.5,
        "range": 1.9,
        "behaviorId": "unit.melee",
        "renderId": "troop.qi"
      },
      "nong": {
        "char": "农",
        "produce": 2,
        "interval": 3,
        "maxLevel": 3,
        "behaviorId": "unit.producer",
        "renderId": "troop.nong"
      }
    },
    "levelMult": 2.2,
    "maxLevel": 5,
    "heroes": {
      "liubei": {
        "name": "刘备",
        "chars": [
          "刘",
          "备"
        ],
        "dmg": 26,
        "cd": 0.8,
        "range": 3.2,
        "ultCd": 16,
        "initialUltCooldownRatio": 0.5,
        "skillId": "aura",
        "renderId": "hero.liubei"
      },
      "guanyu": {
        "name": "关羽",
        "chars": [
          "关",
          "羽"
        ],
        "dmg": 34,
        "cd": 0.9,
        "range": 2.6,
        "ultCd": 14,
        "initialUltCooldownRatio": 0.5,
        "skillId": "slash",
        "renderId": "hero.guanyu"
      },
      "zhangfei": {
        "name": "张飞",
        "chars": [
          "张",
          "飞"
        ],
        "dmg": 30,
        "cd": 0.85,
        "range": 2.2,
        "ultCd": 15,
        "initialUltCooldownRatio": 0.5,
        "skillId": "shout",
        "renderId": "hero.zhangfei"
      },
      "zhaoyun": {
        "name": "赵云",
        "chars": [
          "赵",
          "云"
        ],
        "dmg": 36,
        "cd": 0.75,
        "range": 3,
        "ultCd": 15,
        "initialUltCooldownRatio": 0.5,
        "skillId": "dragon",
        "renderId": "hero.zhaoyun"
      },
      "huangzhong": {
        "name": "黄忠",
        "chars": [
          "黄",
          "忠"
        ],
        "dmg": 30,
        "cd": 1,
        "range": 4.5,
        "ultCd": 16,
        "initialUltCooldownRatio": 0.5,
        "skillId": "rain",
        "renderId": "hero.huangzhong"
      }
    },
    "skills": {
      "dragon": {
        "handlerId": "skill.dragon",
        "dmg": 90,
        "effectIds": [
          "effect.dragon",
          "effect.ink",
          "effect.text"
        ],
        "effectSpeed": 14,
        "effectLife": 5,
        "hitDistance": 1.2
      },
      "rain": {
        "handlerId": "skill.rain",
        "dmg": 55,
        "effectIds": [
          "effect.rain",
          "effect.text"
        ]
      },
      "shout": {
        "handlerId": "skill.shout",
        "dmg": 20,
        "stun": 2.5,
        "effectIds": [
          "effect.ring",
          "effect.text"
        ]
      },
      "slash": {
        "handlerId": "skill.slash",
        "dmg": 130,
        "range": 3,
        "effectIds": [
          "effect.ring",
          "effect.slash",
          "effect.text"
        ]
      },
      "aura": {
        "handlerId": "skill.aura",
        "mult": 1.5,
        "dur": 8,
        "effectIds": [
          "effect.ring",
          "effect.text"
        ]
      }
    },
    "enemy": {
      "baseHp": 24,
      "hpGrowth": 1.22,
      "baseSpeed": 1.05,
      "types": {
        "normal": {
          "char": "贼",
          "hpMul": 1,
          "spdMul": 1,
          "size": 1,
          "renderId": "enemy.normal"
        },
        "fast": {
          "char": "贼",
          "hpMul": 0.6,
          "spdMul": 1.8,
          "size": 0.9,
          "tint": "#6a7846",
          "renderId": "enemy.fast"
        },
        "tank": {
          "char": "贼",
          "hpMul": 3.2,
          "spdMul": 0.55,
          "size": 1.25,
          "tint": "#56514a",
          "renderId": "enemy.tank"
        },
        "elite": {
          "char": "贼",
          "hpMul": 6,
          "spdMul": 0.8,
          "size": 1.3,
          "tint": "#8d2720",
          "renderId": "enemy.elite"
        },
        "boss": {
          "char": "贼",
          "hpMul": 22,
          "spdMul": 0.45,
          "size": 1.6,
          "tint": "#711",
          "renderId": "enemy.boss"
        }
      }
    },
    "waves": {
      "size": {
        "base": 6,
        "perWave": 1
      },
      "spawnInterval": 0.85,
      "breakTime": 3.5,
      "killReward": {
        "base": 2,
        "stepEvery": 5,
        "step": 1
      },
      "waveBonus": {
        "base": 8,
        "perWave": 2
      }
    },
    "items": {
      "shovel": {
        "behaviorId": "item.open-locked-cell",
        "renderId": "item.shovel"
      },
      "brush": {
        "behaviorId": "item.rewrite-featured-hero-char",
        "renderId": "item.brush"
      },
      "luoyang-shovel": {
        "behaviorId": "item.periodic-generator",
        "renderId": "item.luoyang-shovel",
        "interval": 60,
        "outputItemId": "shovel"
      }
    }
  },
  "levels": {
    "$schema": "./schemas/levels.schema.json",
    "schemaVersion": "1.0.0",
    "version": "1.0.0",
    "maps": {
      "julu": {
        "symmetry": "rotate-180",
        "lanes": [
          [
            {
              "r": 0,
              "c": 7
            },
            {
              "r": 1,
              "c": 7
            },
            {
              "r": 1,
              "c": 6
            },
            {
              "r": 1,
              "c": 5
            },
            {
              "r": 1,
              "c": 4
            },
            {
              "r": 2,
              "c": 4
            },
            {
              "r": 2,
              "c": 5
            },
            {
              "r": 2,
              "c": 6
            },
            {
              "r": 2,
              "c": 7
            },
            {
              "r": 3,
              "c": 7
            },
            {
              "r": 3,
              "c": 6
            },
            {
              "r": 3,
              "c": 5
            },
            {
              "r": 3,
              "c": 4
            },
            {
              "r": 3,
              "c": 3
            },
            {
              "r": 3,
              "c": 2
            },
            {
              "r": 3,
              "c": 1
            },
            {
              "r": 3,
              "c": 0
            },
            {
              "r": 2,
              "c": 0
            },
            {
              "r": 2,
              "c": 1
            },
            {
              "r": 2,
              "c": 2
            },
            {
              "r": 1,
              "c": 2
            },
            {
              "r": 1,
              "c": 1
            },
            {
              "r": 1,
              "c": 0
            },
            {
              "r": 0,
              "c": 0
            }
          ],
          [
            {
              "r": 9,
              "c": 0
            },
            {
              "r": 8,
              "c": 0
            },
            {
              "r": 8,
              "c": 1
            },
            {
              "r": 8,
              "c": 2
            },
            {
              "r": 8,
              "c": 3
            },
            {
              "r": 7,
              "c": 3
            },
            {
              "r": 7,
              "c": 2
            },
            {
              "r": 7,
              "c": 1
            },
            {
              "r": 7,
              "c": 0
            },
            {
              "r": 6,
              "c": 0
            },
            {
              "r": 6,
              "c": 1
            },
            {
              "r": 6,
              "c": 2
            },
            {
              "r": 6,
              "c": 3
            },
            {
              "r": 6,
              "c": 4
            },
            {
              "r": 6,
              "c": 5
            },
            {
              "r": 6,
              "c": 6
            },
            {
              "r": 6,
              "c": 7
            },
            {
              "r": 7,
              "c": 7
            },
            {
              "r": 7,
              "c": 6
            },
            {
              "r": 7,
              "c": 5
            },
            {
              "r": 8,
              "c": 5
            },
            {
              "r": 8,
              "c": 6
            },
            {
              "r": 8,
              "c": 7
            },
            {
              "r": 9,
              "c": 7
            }
          ]
        ],
        "openCells": [
          {
            "r": 0,
            "c": 2
          },
          {
            "r": 0,
            "c": 3
          },
          {
            "r": 0,
            "c": 4
          },
          {
            "r": 4,
            "c": 2
          },
          {
            "r": 4,
            "c": 3
          },
          {
            "r": 4,
            "c": 4
          },
          {
            "r": 4,
            "c": 5
          },
          {
            "r": 5,
            "c": 2
          },
          {
            "r": 5,
            "c": 3
          },
          {
            "r": 5,
            "c": 4
          },
          {
            "r": 5,
            "c": 5
          },
          {
            "r": 9,
            "c": 3
          },
          {
            "r": 9,
            "c": 4
          },
          {
            "r": 9,
            "c": 5
          }
        ],
        "spawnCells": [
          {
            "r": 0,
            "c": 7
          },
          {
            "r": 9,
            "c": 0
          }
        ],
        "gateCells": [
          {
            "r": 0,
            "c": 0
          },
          {
            "r": 9,
            "c": 7
          }
        ],
        "spawnDecorationId": "bramble",
        "legacyPathLane": 0
      }
    },
    "stages": [
      {
        "id": "star-1",
        "name": "烽燧初战",
        "star": 1,
        "mapId": "julu",
        "featuredHero": "zhaoyun",
        "waveCount": 5,
        "enemyHpMul": 0.85,
        "finalEnemy": "elite",
        "enemyPlan": {
          "fastFromWave": 4,
          "tankFromWave": 7
        }
      },
      {
        "id": "star-2",
        "name": "疾骑突阵",
        "star": 2,
        "mapId": "julu",
        "featuredHero": "guanyu",
        "waveCount": 5,
        "enemyHpMul": 0.95,
        "finalEnemy": "elite",
        "enemyPlan": {
          "fastFromWave": 3,
          "tankFromWave": 5
        }
      },
      {
        "id": "star-3",
        "name": "巨甲压境",
        "star": 3,
        "mapId": "julu",
        "featuredHero": "zhangfei",
        "waveCount": 5,
        "enemyHpMul": 1,
        "finalEnemy": "elite",
        "enemyPlan": {
          "fastFromWave": 3,
          "tankFromWave": 4
        }
      },
      {
        "id": "star-4",
        "name": "悍将破围",
        "star": 4,
        "mapId": "julu",
        "featuredHero": "huangzhong",
        "waveCount": 5,
        "enemyHpMul": 1.1,
        "finalEnemy": "elite",
        "enemyPlan": {
          "fastFromWave": 2,
          "tankFromWave": 3
        }
      },
      {
        "id": "star-5",
        "name": "魁首决战",
        "star": 5,
        "mapId": "julu",
        "featuredHero": "liubei",
        "waveCount": 5,
        "enemyHpMul": 1.15,
        "finalEnemy": "boss",
        "enemyPlan": {
          "fastFromWave": 2,
          "tankFromWave": 3
        }
      }
    ]
  },
  "copy": {
    "$schema": "./schemas/copy.zh-CN.schema.json",
    "schemaVersion": "1.0.0",
    "version": "1.0.0",
    "locale": "zh-CN",
    "strings": {
      "game.title": "赵云与阿斗",
      "campaign.rank": "军士一",
      "map.julu.name": "巨鹿",
      "resource.protected.name": "阿斗",
      "resource.currency.name": "馒头",
      "stage.star-1.name": "烽燧初战",
      "stage.star-2.name": "疾骑突阵",
      "stage.star-3.name": "巨甲压境",
      "stage.star-4.name": "悍将破围",
      "stage.star-5.name": "魁首决战",
      "title.stage.locked": "锁",
      "title.stage.unlocked": "关",
      "title.stage.notUnlocked": "未解锁",
      "title.stage.summary": "第 {stage} 关 · {stageName} · 已解锁 {unlocked}/{total}",
      "title.reset": "重置进度",
      "title.reset.confirm": "再按一次确认重置",
      "title.reset.memoryOnly": "仅本次会话已重置 · 刷新后可能恢复",
      "title.start": "开始游戏",
      "title.ranking": "排行榜",
      "title.backpack": "武器背包",
      "title.board.protectedGlyph": "斗",
      "title.board.heroGlyph": "云",
      "title.board.heroName": "赵 云",
      "title.avatar.glyph": "云",
      "title.coin.glyph": "刀",
      "battle.camp": "营",
      "battle.gate": "营",
      "battle.status.stunned": "晕",
      "battle.recruit": "征兵",
      "battle.recruit.batch": "征满",
      "battle.recruit.batchPreview": "可征 {count} · 耗 {cost}",
      "battle.recruit.batchResult": "征得 {count} · 耗 {cost}",
      "battle.benchFull": "营满",
      "battle.recruit.shovel": "得铲子 ×1",
      "battle.recruit.result": "募得「{label}」",
      "battle.deploy.openLand": "开地",
      "battle.brush.result": "改作「{char}」",
      "battle.hero.join": "{heroName} 参战!",
      "battle.hero.cast": "【{heroName}】",
      "battle.hero.skill.dragon": "赵云 · 火龙破阵",
      "battle.wave.label": "第{wave}波",
      "battle.wave.ready": "点击迎敌",
      "battle.wave.incoming": "来袭 · {seconds}",
      "battle.wave.cleared": "第{wave}波克复 +{reward}馒头",
      "battle.pause.title": "战局暂停",
      "battle.pause.hint": "点左上暂停或按 P 继续",
      "battle.boss.name": "魁首",
      "battle.boss.incoming": "魁首来袭",
      "battle.danger": "危",
      "battle.enemy.defeated": "破",
      "battle.enemy.leak": "-1❤",
      "battle.shovel.generated": "洛阳铲产出普通铲 ×1",
      "battle.tool.pending": "待发",
      "battle.brush.hint": "点一个已部署普通单位改写成英雄字",
      "battle.shovel.hint": "把铲子拖到青色封地开垦",
      "result.victory": "大捷",
      "result.defeat": "败北",
      "result.victory.summary": "{stageName}告捷 · 歼敌 {kills}",
      "result.defeat.summary": "阿斗被掳… 撑到第 {wave} 波 · 歼敌 {kills}",
      "result.storageWarning": "存储受限 · 进度暂存于本次会话",
      "result.next": "下一关",
      "result.complete": "凯旋归营",
      "result.retry": "重整再战",
      "result.fiveStars": "五星",
      "status.title": "赵云与阿斗，{rank}，已获 {stars} 星，第 {stage} 关{notice}",
      "status.result": "{result}，第 {stage} 关，第 {wave} 波，歼敌 {kills}",
      "status.battle": "巨鹿，第 {stage} 关，第 {wave} 波，命 {lives}",
      "status.resetConfirm": "，请再次确认重置",
      "status.resetMemoryOnly": "，存储受限，刷新后旧进度可能恢复"
    },
    "stageNumerals": [
      "一",
      "二",
      "三",
      "四",
      "五"
    ]
  },
  "theme": {
    "$schema": "./schemas/theme.schema.json",
    "schemaVersion": "1.0.0",
    "version": "1.0.0",
    "id": "ink-warm",
    "fontFamily": "\"Kaiti SC\",\"STKaiti\",KaiTi,\"KaiTi SC\",serif",
    "assetRefs": [
      "battlefield.ink",
      "title.mascot",
      "tools.atlas"
    ],
    "assetBindings": {
      "battleBackdrop": "battlefield.ink",
      "titleMascot": "title.mascot",
      "toolIconAtlas": "tools.atlas"
    },
    "colors": {
      "pageBackground": "#17150f",
      "canvasBackground": "#f0e4cd",
      "paper": "#f0e4cd",
      "paperLight": "#fffaf1",
      "paperRaised": "#fffdf6",
      "ink": "#20221d",
      "inkStrong": "#171913",
      "inkStructure": "#30352e",
      "inkMuted": "#686154",
      "cinnabar": "#a52f27",
      "cinnabarPrimary": "#bd3c30",
      "cinnabarAction": "#c94a36",
      "gold": "#dfa91f",
      "goldReward": "#dfa91f",
      "mutedGold": "#88764b",
      "qingPlayable": "#38765f",
      "qingPlayableWash": "rgba(199,224,208,0.96)",
      "lockedCell": "rgba(105,113,107,0.90)",
      "openCell": "rgba(199,224,208,0.96)",
      "pathCell": "rgba(221,198,166,0.96)",
      "routeLine": "#30352e",
      "routeArrow": "#bd3c30",
      "validTarget": "#2f8461",
      "mergeTarget": "#d3a21e",
      "swapTarget": "#2f8461",
      "invalidTarget": "#bd3028",
      "gate": "#a74635",
      "danger": "#b72f28",
      "brush": "#4f574c",
      "shovel": "#9c7625",
      "boardSurface": "#ead9bc",
      "boardFrame": "#302c25",
      "cellLine": "rgba(48,53,46,0.28)",
      "cardBorder": "#6d6558",
      "disabledSurface": "#c9c1b2",
      "disabledInk": "#70695e"
    },
    "layout": {
      "pause": {
        "x": 40,
        "y": 10,
        "w": 48,
        "h": 48
      },
      "recruit": {
        "x": 142,
        "y": 606,
        "w": 136,
        "h": 62
      },
      "shovel": {
        "x": 44,
        "y": 604,
        "w": 64,
        "h": 64
      },
      "speed": {
        "x": 312,
        "y": 604,
        "w": 64,
        "h": 64
      },
      "bench": {
        "x": 78,
        "y": 542,
        "w": 48,
        "h": 48,
        "gap": 4
      },
      "tools": {
        "x": 48,
        "y": 680,
        "w": 58,
        "h": 52,
        "gap": 6
      },
      "restart": {
        "x": 130,
        "y": 490,
        "w": 160,
        "h": 56
      },
      "start": {
        "x": 110,
        "y": 510,
        "w": 200,
        "h": 68
      },
      "callWave": {
        "x": 138,
        "y": 58,
        "w": 144,
        "h": 34
      },
      "stageSelect": {
        "x": 44,
        "y": 244,
        "w": 60,
        "h": 48,
        "gap": 6
      },
      "resetProgress": {
        "x": 142,
        "y": 690,
        "w": 136,
        "h": 44
      }
    },
    "heroVisuals": {
      "hero.liubei": {
        "paper": "#f3e4bd",
        "accent": "#b8842f",
        "ink": "#7b4f14",
        "glow": "rgba(220,169,62,0.36)",
        "weaponRendererId": "weapon.double-swords"
      },
      "hero.guanyu": {
        "paper": "#dfe8d0",
        "accent": "#4d7449",
        "ink": "#285432",
        "glow": "rgba(76,132,74,0.32)",
        "weaponRendererId": "weapon.guandao"
      },
      "hero.zhangfei": {
        "paper": "#eadced",
        "accent": "#815783",
        "ink": "#65316d",
        "glow": "rgba(143,82,151,0.32)",
        "weaponRendererId": "weapon.serpent-spear"
      },
      "hero.zhaoyun": {
        "paper": "#dbe8ed",
        "accent": "#547e95",
        "ink": "#2e647f",
        "glow": "rgba(76,142,176,0.34)",
        "weaponRendererId": "weapon.spear"
      },
      "hero.huangzhong": {
        "paper": "#f1dfc5",
        "accent": "#ad7631",
        "ink": "#94601e",
        "glow": "rgba(218,146,51,0.34)",
        "weaponRendererId": "weapon.bow"
      }
    },
    "renderers": {
      "scenes": {
        "title": "scene.ink-warm-title",
        "battle": "scene.ink-warm-battle",
        "result": "scene.ink-warm-result"
      },
      "troops": {
        "troop.dao": "card.ink-troop",
        "troop.qiang": "card.ink-troop",
        "troop.gong": "card.ink-troop",
        "troop.qi": "card.ink-troop",
        "troop.nong": "card.ink-troop"
      },
      "enemies": {
        "enemy.normal": "enemy.ink-normal",
        "enemy.fast": "enemy.ink-fast",
        "enemy.tank": "enemy.ink-tank",
        "enemy.elite": "enemy.ink-elite",
        "enemy.boss": "enemy.ink-boss"
      },
      "items": {
        "item.shovel": "item.atlas-shovel",
        "item.brush": "item.atlas-brush",
        "item.luoyang-shovel": "item.atlas-shovel"
      },
      "effects": {
        "effect.ink": "effect.ink-splash",
        "effect.text": "effect.floating-text",
        "effect.slash": "effect.ink-slash",
        "effect.ring": "effect.expanding-ring",
        "effect.dragon": "effect.flame-dragon",
        "effect.rain": "effect.arrow-rain"
      }
    },
    "toolAtlas": {
      "assetId": "tools.atlas",
      "columns": 4,
      "rows": 3,
      "sourceSize": 256,
      "slots": {
        "currency.mantou": 0,
        "item.shovel": 1,
        "item.treasure": 2,
        "item.brush": 3,
        "item.recruit-scroll": 4,
        "item.meteor": 5,
        "item.recycle": 6,
        "item.inkstone": 7,
        "terrain.soil": 8,
        "item.spikes": 9,
        "item.explosives": 10,
        "item.talisman": 11
      }
    },
    "feedback": {
      "recruit": {
        "effectId": "effect.ring",
        "color": "#bd3c30"
      },
      "deploy": {
        "effectId": "effect.ring",
        "color": "#2f8461"
      },
      "merge": {
        "effectId": "effect.ring",
        "color": "#d3a21e"
      },
      "hero_unlock": {
        "effectId": "effect.ring",
        "color": "#dfa91f"
      },
      "hero_cast": {
        "effectId": "effect.ring",
        "color": "#dfa91f"
      },
      "invalid_action": {
        "effectId": "effect.text",
        "color": "#bd3028"
      }
    },
    "presentation": {
      "backdrop": {
        "artAlpha": 0.38,
        "veilTop": "rgba(245,235,214,0.24)",
        "veilMid": "rgba(238,227,204,0.10)",
        "veilBottom": "rgba(231,216,191,0.20)"
      },
      "strokes": {
        "hairline": 0.8,
        "default": 1.4,
        "strong": 2.2,
        "focus": 3
      },
      "shadows": {
        "cardBlur": 5,
        "cardOffsetY": 2,
        "boardBlur": 8,
        "buttonBlur": 5
      },
      "motion": {
        "titleRevealSeconds": 0.5,
        "feedbackSeconds": 0.62,
        "batchStepSeconds": 0.08,
        "invalidReboundSeconds": 0.22,
        "targetPulseHz": 1.2
      },
      "dragonSkill": {
        "birthSeconds": 0.46,
        "startScale": 0.08,
        "arcLift": 32,
        "originGlowRadius": 24,
        "trailWidth": 4.5
      },
      "route": {
        "lineWidth": 2.4,
        "underlayWidth": 4.4,
        "dash": [
          7,
          5
        ],
        "primaryAlpha": 0.84,
        "secondaryAlpha": 0.7,
        "markerRadius": 11,
        "arrowSize": 7,
        "arrowAlpha": 0.95
      },
      "title": {
        "mascotWidth": 128,
        "mascotMaxWidth": 144,
        "revealOffsetY": 8,
        "revealAlphaStart": 0.78,
        "peripheralAlpha": 0.65
      }
    }
  },
  "assets": {
    "$schema": "./schemas/assets.schema.json",
    "schemaVersion": "1.0.0",
    "version": "1.0.0",
    "assets": [
      {
        "id": "battlefield.ink",
        "path": "../../assets/battlefield-ink-v1.jpg",
        "type": "image",
        "format": "jpeg",
        "width": 887,
        "height": 1774,
        "usage": [
          "page-background",
          "battle-background"
        ],
        "loadPriority": "critical",
        "required": true,
        "fallbackRendererId": "background.paper"
      },
      {
        "id": "title.mascot",
        "path": "../../assets/title-mascot-jiekou-v1.png",
        "type": "image",
        "format": "png",
        "width": 817,
        "height": 812,
        "usage": [
          "title-mascot"
        ],
        "loadPriority": "high",
        "required": true,
        "fallbackRendererId": "title.mascot-canvas"
      },
      {
        "id": "tools.atlas",
        "path": "../../assets/tool-icon-atlas-jiekou-v1.png",
        "type": "image",
        "format": "png",
        "width": 1024,
        "height": 768,
        "usage": [
          "tool-icons"
        ],
        "loadPriority": "high",
        "required": true,
        "fallbackRendererId": "tools.glyphs"
      },
      {
        "id": "enemy.boss-mask",
        "path": "../../assets/boss-mask-v1.png",
        "type": "image",
        "format": "png",
        "width": 1254,
        "height": 1254,
        "usage": [
          "reserved-enemy-boss"
        ],
        "loadPriority": "deferred",
        "required": false
      },
      {
        "id": "enemy.ink-atlas",
        "path": "../../assets/enemy-ink-atlas-v1.png",
        "type": "image",
        "format": "png",
        "width": 1254,
        "height": 1254,
        "usage": [
          "reserved-enemy-atlas"
        ],
        "loadPriority": "deferred",
        "required": false
      },
      {
        "id": "title.legacy-art",
        "path": "../../assets/title-art.jpg",
        "type": "image",
        "format": "jpeg",
        "width": 768,
        "height": 1376,
        "usage": [
          "reserved-title-art"
        ],
        "loadPriority": "deferred",
        "required": false
      }
    ]
  },
  "audio": {
    "$schema": "./schemas/audio.schema.json",
    "schemaVersion": "1.0.0",
    "version": "1.0.0",
    "engineId": "web-audio-synth-v1",
    "cues": {
      "recruit": {
        "group": "sfx",
        "voices": [
          {
            "freq": 520,
            "dur": 0.12,
            "wave": "triangle",
            "gain": 0.1,
            "slide": 0
          },
          {
            "freq": 780,
            "dur": 0.15,
            "wave": "triangle",
            "gain": 0.07,
            "slide": 0
          }
        ]
      },
      "place": {
        "group": "sfx",
        "voices": [
          {
            "freq": 300,
            "dur": 0.08,
            "wave": "square",
            "gain": 0.05,
            "slide": 0
          }
        ]
      },
      "merge": {
        "group": "sfx",
        "voices": [
          {
            "freq": 440,
            "dur": 0.1,
            "wave": "triangle",
            "gain": 0.1,
            "slide": 440
          }
        ]
      },
      "hero": {
        "group": "sfx",
        "voices": [
          {
            "freq": 523,
            "dur": 0.15,
            "wave": "triangle",
            "gain": 0.12,
            "slide": 0
          },
          {
            "freq": 659,
            "dur": 0.2,
            "wave": "triangle",
            "gain": 0.1,
            "slide": 0
          },
          {
            "freq": 784,
            "dur": 0.3,
            "wave": "triangle",
            "gain": 0.1,
            "slide": 0
          }
        ]
      },
      "fail": {
        "group": "sfx",
        "voices": [
          {
            "freq": 180,
            "dur": 0.15,
            "wave": "sawtooth",
            "gain": 0.05,
            "slide": -80
          }
        ]
      },
      "ult": {
        "group": "sfx",
        "voices": [
          {
            "freq": 220,
            "dur": 0.4,
            "wave": "sawtooth",
            "gain": 0.08,
            "slide": -120
          }
        ]
      }
    },
    "eventMap": {
      "recruit_result": "recruit",
      "deploy": "place",
      "merge": "merge",
      "hero_unlock": "hero",
      "hero_cast": "ult",
      "invalid_action": "fail"
    },
    "bgm": []
  },
  "events": {
    "$schema": "./schemas/events.schema.json",
    "schemaVersion": "1.0.0",
    "version": "1.0.0",
    "gameVersion": "1.0.0",
    "rulesetVersion": "1.0.0",
    "contentVersion": "1.0.0",
    "requiredCommonFields": [
      "eventId",
      "gameVersion",
      "rulesetVersion",
      "contentVersion",
      "sessionTime",
      "stage",
      "wave",
      "resourceSnapshot",
      "result",
      "reason"
    ],
    "events": [
      {
        "id": "session_start",
        "category": "session",
        "requiredFields": [],
        "privacy": "none"
      },
      {
        "id": "session_end",
        "category": "session",
        "requiredFields": [
          "result",
          "reason"
        ],
        "privacy": "none"
      },
      {
        "id": "stage_start",
        "category": "stage",
        "requiredFields": [
          "stage"
        ],
        "privacy": "none"
      },
      {
        "id": "stage_end",
        "category": "stage",
        "requiredFields": [
          "stage",
          "result",
          "reason"
        ],
        "privacy": "none"
      },
      {
        "id": "recruit_attempt",
        "category": "recruit",
        "requiredFields": [
          "cost"
        ],
        "privacy": "none"
      },
      {
        "id": "recruit_result",
        "category": "recruit",
        "requiredFields": [
          "cost",
          "result",
          "reason"
        ],
        "privacy": "none"
      },
      {
        "id": "deploy",
        "category": "deploy",
        "requiredFields": [
          "unitId",
          "cell",
          "result",
          "reason"
        ],
        "privacy": "none"
      },
      {
        "id": "merge",
        "category": "merge",
        "requiredFields": [
          "unitId",
          "level",
          "result",
          "reason"
        ],
        "privacy": "none"
      },
      {
        "id": "hero_unlock",
        "category": "hero",
        "requiredFields": [
          "heroId",
          "result",
          "reason"
        ],
        "privacy": "none"
      },
      {
        "id": "hero_cast",
        "category": "hero",
        "requiredFields": [
          "heroId",
          "skillId",
          "result",
          "reason"
        ],
        "privacy": "none"
      },
      {
        "id": "wave_start",
        "category": "wave",
        "requiredFields": [
          "stage",
          "wave"
        ],
        "privacy": "none"
      },
      {
        "id": "wave_end",
        "category": "wave",
        "requiredFields": [
          "stage",
          "wave",
          "result",
          "reason"
        ],
        "privacy": "none"
      },
      {
        "id": "enemy_leak",
        "category": "enemy_leak",
        "requiredFields": [
          "enemyId",
          "livesRemaining",
          "reason"
        ],
        "privacy": "none"
      },
      {
        "id": "invalid_action",
        "category": "invalid_action",
        "requiredFields": [
          "actionId",
          "reason"
        ],
        "privacy": "none"
      },
      {
        "id": "retry",
        "category": "retry",
        "requiredFields": [
          "stage",
          "reason"
        ],
        "privacy": "none"
      },
      {
        "id": "quit",
        "category": "quit",
        "requiredFields": [
          "stage",
          "wave",
          "reason"
        ],
        "privacy": "none"
      }
    ]
  }
};
