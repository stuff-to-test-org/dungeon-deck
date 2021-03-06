/**
 * Created by 赢潮 on 2015/3/1.
 */
var UPGRADE_RANGE_LEVEL = {
    FROM_DISCARD : 1,
    FROM_DECK : 2,
    FROM_HAND : 3,
    FROM_DUNGEON : 4
    };

var CARD_PER_LINE = 4;

var GameModel = Backbone.Model.extend({
    defaults:function(){
        return {
            turn: 0,
            score: 0,

            money : 8,
            maxMoney: 8,

            levelUpHpEffect: 5,
            baseHp: 20,
            hp : 1,
            maxHp : 1,

            upgradeChance: 4,

            defense: 0,

            level: 1,
            maxLevel: 1,

            spoiled: 0,
            cunning: 0,
            cunningEffect: 5,
            exp: 0,
            maxExp: 10,
            status: null,
            phase: "hero-generate", //hero-generate , team-enter-dungeon, team-enter-level, team-enter-room, team-leave-room, team-leave-level, team

            //generateHeroType : "deck", //deck, pool
            generateHeroType : "pool",

            initHeroDeck: [{type:"cleric",level:1,maxLevel:1},{type:"cleric",level:1,maxLevel:3},{type:"cleric",level:1,maxLevel:3},{type:"thief",level:1,maxLevel:3}],
            heroDeck: [],
            isHeroDeckShuffle: false,

            //heroList: ["dragonslayer","berserker"],
            heroList: [ "amazon","assassin", "berserker", "cleric", "dragonslayer", "knight", "ninja", "sage", "soldier","sorcerer", "thief", "warrior" ],
            heroLevelPool: [1],
            heroMaxLevelPool: [ 3, 3, 3 ],
            maxHeroMaxLevelAppearCount: 3,
            maxHeroMaxLevel: 3,
            increaseDifficultyPerTurn: 13,
            generateHeroNumber: 1,
            //heroList: [ "sorcerer"],
            initDeck: [ "skeleton", "skeleton","skeleton","skeleton","imp","imp","imp","imp" ],
            //initDeck: [ "magic-missile","skeleton", "skeleton","skeleton","skeleton","imp","imp","imp","imp" ],
            //initDeck: [ /*"titan","arrow-trap","ooze",*/"dragon","arrow-trap","lilith","arrow-trap" ],
            deck: [],
            isInitDeckShuffle: true,

            //initDiscardDeck: [ "magic-missile","skeleton", "skeleton","skeleton","skeleton","imp","imp","imp","imp","magic-missile","skeleton", "skeleton","skeleton","skeleton","imp","imp","imp","imp" ],
            initDiscardDeck: [ ],
            discardDeck: [],

            //initHand: ["fireball","magic-missile","fireball"],
            initHand: ["magic-missile"],
            hand: [], //魔法
            maxHand: 1,

            team: [],

            costPerStage: 4,
            costCut: 0,
            stage: [],
            stageNumber: 0,

            upgradeRangeLevel: UPGRADE_RANGE_LEVEL.FROM_DISCARD,

            //initBonus: ["blacksmith","maxHp"],
            initBonus: ["upgradeChance","maxHp","money","upgradeFromDeck","cullDiscard","cullDeck","flowBuyableCard","blacksmith", "library","prison","spoiled-food"],
            bonusPool : [],
            bonusChoiceNumber:3,
            bonusEachLevelUp: "alwaysLevelUpBonus",

            unlockedBuyableCards:["basilisk","dark-elf","dragon","gargoyle","ghost","lich","lilith","minotaur","ooze","orc","orc-bandit","orc-warlord","spider","titan", "treefolk",
                                    "cyclone","fireball","lightening","touchstone","war-drum",
                                    "hen-den",
                                    "arrow-trap","pitfall","poison-gas","rolling-boulder"],
            regularBuyableCards: [],
            initRegularBuyableCount : 4,
            initRegularBuyableCards : [
                {
                    type:"imp",
                    count: 8
                },
                {
                    type:"skeleton",
                    count: 8
                },
                {
                    type:"magic-missile",
                    count: 8
                },
                {
                    type:"vault",
                    count: 8
                }],

            initFlowBuyableCards: [["arrow-trap"],["pitfall"]],
            flowBuyableLineNumber: 2,
            flowBuyableCardLines: [],

            poisonEffect: 1
        }
    },
    initialize:function(){
        this.expUnused = 0;
        this.set("maxHp",this.get("baseHp"));
        this.setLevel(1);
        this.on("change:cunning",function(){
            this.set("maxExp",this.calExpRequire());
        },this)
    },
    increaseTurn:function(){
        var turn = this.get("turn");
        this.set("turn", ++turn);
        if ( turn % this.get("increaseDifficultyPerTurn") === 0 ) {
            if ( this.get("maxHeroMaxLevelAppearCount") >= this.get("maxHeroMaxLevel")) {
                this.set({
                    maxHeroMaxLevel: this.get("maxHeroMaxLevel") + 1,
                    maxHeroMaxLevelAppearCount : 0
                });
            }
            this.set("maxHeroMaxLevelAppearCount", this.get("maxHeroMaxLevelAppearCount") + 1);
            this.get("heroMaxLevelPool").push( this.get("maxHeroMaxLevel") );
            var heroLevelPool = this.get("heroLevelPool");
            for ( var i = 1; i < this.get("maxHeroMaxLevel") ; i++) {
                heroLevelPool.push(i);
            }
            if ( turn % (this.get("increaseDifficultyPerTurn")*4) === 0 ) {
                var genHeroNumber = this.get("generateHeroNumber");
                if ( genHeroNumber < 4 ) this.set("generateHeroNumber",genHeroNumber+1);
            }
        }
    },
    changeTeamPosition:function(team){
        var oldTeam = this.get("team");
        for ( var i = 0; i < oldTeam.length; i++ ) {
            var model = oldTeam[i];
            model.onBeforePositionInTeamChange(i);
        }
        this.set("team",team);
        for ( var i = 0; i < team.length; i++ ) {
            var model = team[i];
            model.set("positionInTeam", i, {silent:true});
            model.trigger("change:positionInTeam");
        }
    },
    sortTeam:function(){
        var team = this.get("team");
        team = _.sortBy(team, function(heroModel){
            return 1000000 - (heroModel.get("hp") * 100 + heroModel.get("level"));
        });
        /*this.set("team",team);
        for ( var i = 0; i < team.length; i++ ) {
            var model = team[i];
            model.set("positionInTeam", i, {silent:true});
            model.trigger("change:positionInTeam");
        }*/
        this.changeTeamPosition(team);
    },
    setLevel:function(l){
        this.set("level",l);
        this.set("hp", this.get("maxHp"));
        this.set("exp",0);
        this.set("maxExp",this.calExpRequire(l));
    },
    getExp:function(exp){
        if ( this.expUnused == 0 ) {
            this.expUnused += exp;
            this.checkLevelUp();
        } else {
            this.expUnused += exp;
        }
    },
    getScore:function(score){
        this.set("score",this.get("score")+score);
    },
    loseScore:function(score){
        this.set("score",this.get("score")-score);
    },
    getTavernRecoveryEffect:function(diff){
        return Math.max( diff - this.get("spoiled"), 0 );
    },
    getPayFromTavern:function(money){
        this.getMoney(money);
    },
    getMoney:function(money){
        this.set("money",Math.min( this.get("maxMoney") , this.get("money")+money ) );
    },
    useMoney:function(money){
        this.set("money", Math.max(0, this.get("money") - money ));
    },
    payHp:function(hp){
        this.set("hp",Math.max(1, this.get("hp")-hp));
    },
    payScore:function(score){
        this.set("score",Math.max(0, this.get("score")-score));
    },
    getHp:function(hp){
        this.set("hp",Math.min(this.get("maxHp"), this.get("hp")+hp));
    },
    calExpRequire: function (lv) {
        lv = lv || this.get("level");
        return Math.round((Math.log10(lv) * lv * 8.8 /*16.61*/ + 5) * (1 - (this.get("cunningEffect") / 100) * this.get("cunning")));
    },
    checkLevelUp:function(){
        var currentExp = this.get("exp");
        var expRequire = this.get("maxExp");
        if (currentExp + this.expUnused >= expRequire) {
            this.levelUp();
            this.expUnused -= ( expRequire - currentExp );
            mainGame.showLevelUp(function(){
                this.checkLevelUp();
            },this)
        } else {
            this.set("exp", currentExp + this.expUnused);
            this.expUnused = 0;
        }
    },
    levelUp:function(){
        var newLevel = this.get("level") + 1;
        this.set("maxHp",this.get("maxHp")+this.get("levelUpHpEffect"));
        this.setLevel(newLevel);
    },
    isTeamAlive:function(){
        var team = this.get("team");
        if ( team.length === 0 )
            return false;
        return _.any(team,function(heroModel){
            return heroModel.get("hp") > 0;
        },this)
    },
    getTeamAttackDungeonHeartPower:function(){
        return _.reduce(this.get("team"),function(memo, heroModel){
            if ( heroModel.isAlive() ) {
                return memo + heroModel.get("attackHeartPower");
            } else return memo;
        }, 0 ,this)
    },
    removeDeadHeroFromTeam:function(){
        var team = this.get("team");
        for ( var i = 0;i < team.length; ) {
            var model = team[i];

            if ( model.isAlive() ) {
                i++;
            } else {
                team.splice(i,1);
                model.destroy();
                model.off();
                model = null;
            }
        }
        this.sortTeam();
    },
    overMaxLevelHeroLeave:function(){
        var team = this.get("team");
        for ( var i = 0;i < team.length; ) {
            var model = team[i];

            if ( model.get("leaving") ) {
                model.onBeforePositionInTeamChange(model.get("positionInTeam"));
                team.splice(i,1);
                model.trigger("leaveTeam");
                model = null;
            } else {
                i++;
            }
        }
        this.sortTeam();
    },
    getBuildCost:function(){
        return Math.max(1, this.get("stageNumber")* this.get("costPerStage") - this.get("costCut"));
    },
    isFullHand:function(){
        return this.get("hand").length >= this.get("maxHand");
    },
    getSpellCard:function(cardSprite){
        this.get("hand").push(cardSprite.model);
        cardSprite.removeFromParent(true);
        this.trigger("change:hand");
    },
    useSpellCard:function(cardModel){
        var hand = this.get("hand");
        var index = hand.indexOf(cardModel);
        if ( index != -1 )
            this.get("hand").splice(index,1);
        this.trigger("change:hand");
    },
    initDeck:function(){
        _.each( this.get("initDeck"), function(cardName){
            var Model = DUNGEON_CLASS_MAP[cardName];
            var model = new Model();
            this.get("deck").push( model );
            this.getScore(model.get("score"));
        },this);

        if ( this.get("isInitDeckShuffle") )
            this.set("deck",_.shuffle(this.get("deck")));
    },
    initDiscardDeck:function(){
        _.each( this.get("initDiscardDeck"), function(cardName){
            var Model = DUNGEON_CLASS_MAP[cardName];
            var model = new Model({
                side: "front"
            });
            this.get("discardDeck").push( model );
            this.getScore(model.get("score"));
        },this);

        if ( this.get("isInitDeckShuffle") )
            this.set("deck",_.shuffle(this.get("deck")));
    },
    initRegularBuyableCards:function(){
        var initBuyable = this.get("initRegularBuyableCards");
        _.each( initBuyable , function(entry){
            this.newRegularBuyableDeck(entry);
        },this);
        if ( initBuyable.length < this.get("initRegularBuyableCount") ) {
            var diff = this.get("initRegularBuyableCount") - initBuyable.length;
            for ( var i = 0 ; i < diff; i++ ){
                this.randomUnlockedToBuyable();
            }
        }
    },
    initFlowBuyableCards:function(){
        var lineNumber = 0;
        var cardLines= this.get("flowBuyableCardLines");
        _.each( this.get("initFlowBuyableCards"), function(line){
            cardLines[lineNumber] = [];
            _.each(line,function(cardName){
                cardLines[lineNumber].push( new DUNGEON_CLASS_MAP[cardName]({side:"front"}));
            });
            lineNumber++;
        });
        this.refillFlowBuyableCards();
    },
    maintainFlowBuyableCards:function(){
        var cardLines= this.get("flowBuyableCardLines");
        _.each( cardLines, function(line){
            line.shift();
        });
        this.removeNullFlowBuyableCards();
        this.refillFlowBuyableCards();
    },
    removeNullFlowBuyableCards:function(){
        var cardLines= this.get("flowBuyableCardLines");
        for ( var i = 0; i < cardLines.length; i++ ){
            var line = cardLines[i];
            line = _.filter(line,function(model){
                return model != null;
            });
            cardLines[i] = line;
        }
    },
    refillFlowBuyableCards:function(){
        var cardLines= this.get("flowBuyableCardLines");
        _.each( cardLines, function(line){
            for ( var i = line.length; i<CARD_PER_LINE; i++){
                var type = _.sample(this.get("unlockedBuyableCards"))
                line.push( new DUNGEON_CLASS_MAP[type]({side:"front"}));
            }
        },this);
    },
    newRegularBuyableDeck:function(entry){
        var deck = [];
        for ( var i = 0; i < entry.count; i++ ) {
            var Model = DUNGEON_CLASS_MAP[entry.type];
            var model = new Model({
                side:"front"
            });
            deck.push( model );
        }
        this.get("regularBuyableCards").push(deck);
    },
    randomUnlockedToBuyable:function(){
        var unlocked = this.get("unlockedBuyableCards");
        if ( unlocked.length ) {
            var index = Math.floor(Math.random()*unlocked.length);
            var type = unlocked[index];
            unlocked.splice(index,1);
            var entry = {
                type: type,
                count: 8
            };
            this.newRegularBuyableDeck(entry);
        }
    },
    initHeroDeck:function(){
        if ( this.get("isShuffleHeroDeck") ) {
            this.set("heroDeck", _.shuffle(this.get("initHeroDeck")));
        } else {
            this.set("heroDeck", _.clone(this.get("initHeroDeck")));
        }
    },
    initSpellBook:function(){
        _.each( this.get("initHand"), function(cardName){
            var Model = DUNGEON_CLASS_MAP[cardName];
            var model = new Model({
                side: "front"
            });
            this.get("hand").push( model );
            this.getScore(model.get("score"));
        },this);
        this.trigger("change:hand");
    },
    initBonus:function(){
        _.each( this.get("initBonus"), function(bonusName){
            var Model = LEVEL_UP_BONUS_CLASS_MAP[bonusName];
            var model = new Model();
            this.get("bonusPool").push( model );
        },this);

        var eachLevelBonus = this.get("bonusEachLevelUp");
        if ( eachLevelBonus ) {
            var Model = LEVEL_UP_BONUS_CLASS_MAP[eachLevelBonus];
            this.set("bonusEachLevelUp", new Model());
        }
    },
    beAttacked:function(damage){
        var hp = this.get("hp");
        var realDamage = damage - this.get("defense");
        var hpLose = Math.min(hp, realDamage);
        this.set("hp", hp - hpLose );
        return hpLose;
    },
    initAll:function(){
        this.initHeroDeck();
        this.initDeck();
        this.initDiscardDeck();
        this.initRegularBuyableCards();
        this.initFlowBuyableCards();
        this.initSpellBook();
        this.initBonus();
    },
    gainUpgradeChance:function(count){
        this.set("upgradeChance", this.get("upgradeChance")+count);
    },
    cullFromDiscard:function(cardModel){
        var deck = this.get("discardDeck");
        var index = _.indexOf(deck, cardModel);
        if ( index != -1 ) {
            deck.splice(index, 1);
            cardModel.onExile();
            this.trigger("change:discardDeck", this);
            return true;
        }
        return false;
    },
    cullFromDeck:function(cardModel){
        var deck = this.get("deck");
        var index = _.indexOf(deck, cardModel);
        if ( index != -1 ) {
            deck.splice(index, 1);
            cardModel.onExile();
            this.trigger("change:deck", this);
            return true;
        }
        return false;
    },
    cullCard:function(cardModel){
        if ( !this.cullFromDiscard(cardModel) ) {
            if ( !this.cullFromDeck(cardModel) ) {

            }
        }
    },
    generateHeroModel:function(){
        var generateType = this.get("generateHeroType");
        if ( generateType === "pool") {
            var heroType = _.sample(this.get("heroList"))
            var maxLevel = _.sample(this.get("heroMaxLevelPool"));
            var level = Math.min(_.sample(this.get("heroLevelPool")), maxLevel);
            return new HERO_CLASS_MAP[ heroType ]({
                level: level,
                maxLevel: maxLevel
            });
        } else if ( generateType === "deck" ) {
            var entry = this.get("heroDeck").shift();
            if ( entry ) {
                return new HERO_CLASS_MAP[ entry.type ]({
                    level: entry.level,
                    maxLevel: entry.maxLevel
                });
            } else return null;
        }
    }
})

var DungeonCardModel = Backbone.Model.extend({ //地城牌
    defaults:function(){
        return {
            name: "",
            backType:"dungeon",

            baseCost: 1,
            cost: 1,

            baseScore: 0,
            score: 0,

            baseUpgradeCost: 0,
            upgradeCost: 0,

            side: "back",

            level: 1,
            maxLevel: 1,

            status: "",

            upgradeable: true,
            cullable: true,

            payMoney: 0,
            payScore: 0,
            payHp: 0,
            payCard: 0
        }
    },
    initialize:function(){
        this.initEvent();
        this.initByLevel();
        if ( this.get("level") >= this.get("maxLevel") ) {
            this.maxLevelBonus();
        }
        this.reEvaluate();
    },
    initEvent:function(){
        this.on("change:baseScore", this.evaluateScore, this);
        this.on("change:baseCost", this.evaluateCost, this);
        this.on("change:baseUpgradeCost", this.evaluateUpgradeCost, this);
        this.on("change:level", function(){
            this.initByLevel();
            if ( this.get("level") >= this.get("maxLevel") ) {
                this.maxLevelBonus();
            }
        },this);
    },
    reEvaluate:function(){
        this.evaluateScore();
        this.evaluateCost();
        this.evaluateUpgradeCost();
    },
    initByLevel:function(){
    },
    maxLevelBonus:function(){
    },
    evaluateScore:function(){
        this.set("score", this.get("baseScore"));
    },
    evaluateCost:function(){
        this.set("cost", this.get("baseCost"));
    },
    evaluateUpgradeCost:function(){
        this.set("upgradeCost", this.get("baseUpgradeCost"));
    },
    getDescription:function(){
        var descs = [];
        var desc = CARD_TYPE_MAP[this.get("type")];
        if ( this.get("subtype") ) {
            desc = _.reduce(this.get("subtype").split(" "), function(memo, subtype){
                return memo + "—" + CARD_SUBTYPE_MAP[subtype];
            },desc, this);
        }
        if ( this.get("type") !== "item" && this.get("score") ) {
            desc += "    "+this.get("score")+"{[score]}";
        }
        descs[0] = desc;

        var upgradeAndCullable = "";
        if ( !this.get("upgradeable") ) {
            upgradeAndCullable += "不可升级 "
        }
        if ( !this.get("cullable") ) {
            upgradeAndCullable += "不可被精简"
        }
        if ( upgradeAndCullable !== "" ) descs.push(upgradeAndCullable);
        if ( this.get("payHp") ) {
            descs.push("{[pay-hp]}翻开本牌时支付"+this.get("payHp")+"{[black-hp]}")
        }
        if ( this.get("payMoney") ) {
            descs.push("{[pay-money]}翻开本牌时支付"+this.get("payMoney")+"{[money]}")
        }
        if ( this.get("payScore") ) {
            descs.push("{[pay-score]}翻开本牌时支付"+this.get("payScore")+"{[score]}")
        }
        return descs.join("\n");
    },
    onDiscard : function(){
        this.resetToOrigin();
    },
    onReveal : function(){
    },
    onStageReveal: function(dungeonCards){
    },
    onGain:function(){
        if ( this.get("type") !== "item" ) {
            window.gameModel.getScore(this.get("score"));
        }
    },
    onExile:function(){
        if ( this.get("type") !== "item" ) {
            window.gameModel.loseScore(this.get("score"));
        }
    },
    levelUp:function(silent){
        var newLevel = this.get("level") + 1;
        this.set("level", newLevel);
        this.onLevelUp();
    },
    onLevelUp:function(){
        var ps = this.previous("score");
        var cs = this.get("score");
        window.gameModel.getScore(cs-ps);
    },
    isMaxLevel:function(){
        return this.get("maxLevel") != "NA" && this.get("level") >= this.get("maxLevel");
    },
    resetToOrigin:function(){
        this.set({
            attackBuff: 0,
            attackDebuff: 0
        })
    },
    isEffecting:function(){
        return this.get("side") === "front" && !this.get("exiled")
    },
    isNeedPay:function(){
        return this.get("payMoney") || this.get("payScore") || this.get("payHp");
    },
    onPay:function(){
        var payMoney = this.get("payMoney");
        var payScore = this.get("payScore");
        var payHp = this.get("payHp");

        if ( (!payMoney || gameModel.get("money") >= payMoney) &&
            (!payScore || gameModel.get("score") >= payScore) &&
            (!payHp || gameModel.get("hp") > payHp) ) {
            if ( payMoney ) {
                gameModel.useMoney(payMoney);
                this.trigger("take", {
                    icon: "money"
                });
            }
            if ( payHp ) {
                gameModel.payHp(payHp);
                this.trigger("take", {
                    icon: "hp"
                });
            }
            if ( payScore ) {
                gameModel.payScore(payScore);
                this.trigger("take", {
                    icon: "score"
                });
            }
            this.onPaySuccess();
            return true;
        } else {
            this.onPayFail();
            return false;
        }
    },
    onPayFail:function(){
    },
    onPaySuccess:function(){
    }
})






