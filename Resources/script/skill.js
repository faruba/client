/**
 * User: hammer
 * Date: 13-7-11
 * Time: 上午9:33
 */

var SkillScheme = {
    cid : "ClassId",
    lev : "Level"
};

function Skill(source)
{
    this.ClassId = -1;
    this.Level = 0;
    if( source != null )
    {
        this.parse(source);
    }
}

Skill.prototype.parse = function(source)
{
    loadModule("util.js").applyScheme(this, SkillScheme, source);
}

//--- ui component ---
var UISkill = cc.Node.extend({
    init: function(){
        if( !this._super()) return false;
        //init code here
        this.skill = null;
        this.gray = false;
        return true;
    },
    setSkill: function(ski){
        this.skill = ski;
        this.removeAllChildren();

        if( this.skill != null )
        {
            var table = loadModule("table.js");
            var SkillClass = table.queryTable(TABLE_SKILL, this.skill.ClassId);
            this.icon = cc.Sprite.create(SkillClass.icon);
            if (this.gray){
                this.icon.setColor(cc.c3b(80, 77, 75));
            }
            this.addChild(this.icon);
            if (this.gray == false){
                this.dot = cc.Sprite.create("cardnummask.png");
                this.dot.setAnchorPoint(cc.p(1, 0));
                this.dot.setPosition(cc.p(this.icon.getContentSize().width/2, -this.icon.getContentSize().height/2));
                this.addChild(this.dot);

                this.num = cc.Sprite.createWithSpriteFrameName(this.skill.Level+".png");
                this.num.setPosition(cc.p(this.dot.getContentSize().width/2, this.dot.getContentSize().height/2));
                this.dot.addChild(this.num);
            }
        }
    },
    getSkill: function(){
        return this.skill;
    },
    setGray: function(flag){
        if (flag != null){
            this.gray = flag;
        }
        else{
            this.gray = false;
        }
    }
});

UISkill.create = function(ski){
    var ret = new UISkill();
    ret.init();
    if( ski != null ){
        ret.setSkill(ski);
    }
    return ret;
}

UISkill.make = function(thiz, args){
    var ret = {};
    ret.id = UISkill.create();
    ret.node = ret.id;
    return ret;
}

exports.Skill = Skill;
exports.UISkill = UISkill;