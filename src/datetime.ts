declare function require(path:string):any
var date:{
    isValid(value:string,pattern:string):boolean
} = require('date-and-time');

import ts=require("./typesystem");

export class DateOnlyR extends ts.GenericTypeOf{
    check(i:any):ts.Status {
        if (typeof i=="string"){
            if (!date.isValid(i,"YYYY-MM-DD")){
                return new ts.Status(ts.Status.ERROR,0,"date-only should match to yyyy-mm-dd pattern",this)
            }
            return ts.ok();
        }
        return new ts.Status(ts.Status.ERROR,0,"date-only should be string matching to  yyyy-mm-dd pattern ",this)
    }
    requiredType(){
        return ts.STRING;
    }
    value(){
        return true;
    }
    facetName(){
        return "should be date-only"
    }
}
export class TimeOnlyR extends ts.GenericTypeOf{
    check(i:any):ts.Status {
        if (typeof i=="string"){
            var c=i.indexOf(".");
            if(c!=-1){
                i=i.substring(0,c);
            }

            if (!i.match("[0-9][0-9]:[0-9][0-9]:[0-9][0-9]")||!date.isValid("11 "+i.trim(),"YY HH:mm:ss")){
                return new ts.Status(ts.Status.ERROR,0,"time-only should match to hh:mm:ss[.ff...] pattern",this)
            }
            return ts.ok();
        }
        return new ts.Status(ts.Status.ERROR,0,"time-only should be string matching to  hh:mm:ss[.ff...] pattern ",this)
    }
    requiredType(){
        return ts.STRING;
    }
    value(){
        return true;
    }
    facetName(){
        return "should be time-only"
    }
}
export class DateTimeOnlyR extends ts.GenericTypeOf{
    check(i:any):ts.Status {
        if (typeof i=="string"){
            var c=i.indexOf(".");
            if(c!=-1){
                i=i.substring(0,c);
            }
            if (!i.match("^\\d{4}-\\d{2}-\\d{2}T"+"[0-9][0-9]:[0-9][0-9]:[0-9][0-9]$")){
                return new ts.Status(ts.Status.ERROR,0,"datetime-only should match to yyyy-mm-ddThh:mm:ss[.ff...] pattern",this)
            }
            return ts.ok();
        }
        return new ts.Status(ts.Status.ERROR,0,"datetime-only should be string matching to  yyyy-mm-ddThh:mm:ss[.ff...] pattern ",this)
    }
    requiredType(){
        return ts.STRING;
    }
    value(){
        return true;
    }
    facetName(){
        return "should be datetime-only"
    }
}
var r1=/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\,[ ]+\d{2}[ ]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[ ]+\d{4}[ ]+\d{2}:\d{2}:\d{2}[ ]+GMT/

var r2=/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\,[ ]+\d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}[ ]+\d{2}:\d{2}:\d{2}[ ]+GMT/

var r3=/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\,[ ]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[ ]+\d{1,2}[ ]+\d{2}:\d{2}:\d{2}[ ]+GMT/

var r0=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?((?:[\+\-]\d{2}:\d{2})|Z)$/;
export class DateTimeR extends ts.GenericTypeOf{
    check(i:any):ts.Status {
        var c=ts.VALIDATED_TYPE;
        var rfc2616=false;
        c.customFacets().forEach(x=>{
            if (x.facetName()=="format") {
                if (x.value()==="rfc2616"){
                    rfc2616=true;
                }

            }
        })

        if (typeof i=="string"){
            if (!rfc2616){
                if (!i.match(r0)){
                    return new ts.Status(ts.Status.ERROR,0,"valid rfc3339 formatted string is expected",this)
                }
                return ts.ok();
            }
            else{
                if (!(i.match(r1)||i.match(r2)||i.match(r3))){
                    return new ts.Status(ts.Status.ERROR,0,"valid rfc2616 formatted string is expected",this)
                }
            }
            return ts.ok();
        }
        return new ts.Status(ts.Status.ERROR,0,"valid datetime formatted string is expected",this)
    }
    requiredType(){
        return ts.STRING;
    }
    value(){
        return true;
    }
    facetName(){
        return "should be datetime-only"
    }
}