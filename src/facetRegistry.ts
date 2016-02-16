import ts=require("./typesystem")
import rs=require("./restrictions")
import ms=require("./metainfo")


import {TypeInformation, Discriminator, DiscriminatorValue, Abstract, Polymorphic} from "./typesystem";

import {MinProperties, MaxProperties, MinLength, MaxLength, MinItems , MaxItems, Minimum,
        Maximum, Enum, Pattern, UniqueItems,
        PropertyIs, AdditionalPropertyIs , MapPropertyIs, HasProperty, KnownPropertyRestriction, ComponentShouldBeOfType} from "./restrictions";

import {Default, Example, Description, DisplayName} from "./metainfo";
import {AbstractType} from "./typesystem";
import {XMLInfo} from "./metainfo";



export class FacetPrototype{

    constructor(private _construct:()=>TypeInformation){}

    newInstance():ts.TypeInformation{
        return this._construct();
    }
    isApplyable(t:ts.AbstractType):boolean{
        return t.isSubTypeOf(this.newInstance().requiredType());
    }

    isInheritable():boolean{
        return this.newInstance().isInheritable();
    }
    isConstraint(){
        return this.newInstance() instanceof  ts.Constraint;
    }

    isMeta(){
        return !this.isConstraint();
    }

    name(){
        return this.newInstance()+"";
    }
}
var constraints:FacetPrototype[]=[
    new FacetPrototype(()=>new MinProperties(1)),
    new FacetPrototype(()=>new MaxProperties(1)),
    new FacetPrototype(()=>new MinItems(1)),
    new FacetPrototype(()=>new MaxItems(1)),
    new FacetPrototype(()=>new MinLength(1)),
    new FacetPrototype(()=>new MaxLength(1)),
    new FacetPrototype(()=>new Minimum(1)),
    new FacetPrototype(()=>new Maximum(1)),
    new FacetPrototype(()=>new Enum([""])),
    new FacetPrototype(()=>new Pattern(".")),
    new FacetPrototype(()=>new PropertyIs("x",ts.ANY)),
    new FacetPrototype(()=>new AdditionalPropertyIs(ts.ANY)),
    new FacetPrototype(()=>new MapPropertyIs(".",ts.ANY)),
    new FacetPrototype(()=>new HasProperty("x")),
    new FacetPrototype(()=>new KnownPropertyRestriction()),
    new FacetPrototype(()=>new UniqueItems(true)),
    new FacetPrototype(()=>new ComponentShouldBeOfType(ts.ANY)),
]
var meta:FacetPrototype[]=[
    new FacetPrototype(()=>new Discriminator("kind")),
    new FacetPrototype(()=>new DiscriminatorValue("x")),
    new FacetPrototype(()=>new Default("")),
    new FacetPrototype(()=>new Example("")),
    new FacetPrototype(()=>new Description("")),
    new FacetPrototype(()=>new DisplayName("")),
    new FacetPrototype(()=>new Abstract()),
    new FacetPrototype(()=>new Polymorphic()),
    new FacetPrototype(()=>new XMLInfo())
]


export function allPrototypes():FacetPrototype[]{
    return meta.concat(constraints);
}
export function applyableTo(t:AbstractType){
    return allPrototypes().filter(x=>x.isApplyable(t));
}

export function allMeta(){
    return allPrototypes().filter(x=>x.isMeta());
}
export function allConstraints(){
    return allPrototypes().filter(x=>x.isConstraint());
}