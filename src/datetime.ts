declare function require(path:string):any
var date:{
    isValid(value:string,pattern:string):boolean,
    format(dateObj:Date, formatString:string, utc:boolean):string
    parse(dateString:string, formatString:string, utc:boolean):Date
} = require('date-and-time');

import ts=require("./typesystem");
var messageRegistry = ts.messageRegistry;

function checkDate(dateStr : string) : boolean {
    return checkDateString(dateStr,"YYYY-MM-DD")
}

export class DateOnlyR extends ts.GenericTypeOf{
    check(value:any):ts.Status {
        if (typeof value=="string"){
            if (!checkDate(value)){
                return ts.error(messageRegistry.INVALID_DATEONLY,this);
            }
            return ts.ok();
        }
        return ts.error(messageRegistry.INVALID_DATEONLY,this);
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

function checkTime(time : string): boolean {
    return checkDateString("11 "+time.trim(),"YY HH:mm:ss");
}

export class TimeOnlyR extends ts.GenericTypeOf{
    check(value:any):ts.Status {
        if (typeof value=="string"){

            var regexp = /^([0-9][0-9]:[0-9][0-9]:[0-9][0-9])(.[0-9]+)?$/;
            var matches = value.match(regexp);
            if (!matches){
                return ts.error(messageRegistry.INVALID_TIMEONLY,this);
            }

            var hhmmssTime = matches[1];
            if (!checkTime(hhmmssTime)){
                return ts.error(messageRegistry.INVALID_TIMEONLY,this);
            }
            return ts.ok();
        }
        return ts.error(messageRegistry.INVALID_TIMEONLY,this);
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
    check(value:any):ts.Status {
        if (typeof value=="string"){

            var regexp = /^(\d{4}-\d{2}-\d{2})T([0-9][0-9]:[0-9][0-9]:[0-9][0-9])(.[0-9]+)?$/;
            var matches = value.match(regexp);
            if (!matches || matches.length < 3){
                return ts.error(messageRegistry.INVALID_DATETIMEONLY,this);
            }

            var date = matches[1];
            var time = matches[2];
            if (!checkDate(date) || !checkTime(time)) {
                return ts.error(messageRegistry.INVALID_DATETIMEONLY,this);
            }
            return ts.ok();
        }
        return ts.error(messageRegistry.INVALID_DATETIMEONLY,this);
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

var r0=/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?((?:[\+\-]\d{2}:\d{2})|Z)$/;
export class DateTimeR extends ts.GenericTypeOf{
    check(value:any):ts.Status {
        var c=ts.VALIDATED_TYPE;
        var rfc2616=false;
        c.allFacets().forEach(x=>{
            if (x.facetName()=="format") {
                if (x.value()==="rfc2616"){
                    rfc2616=true;
                }

            }
        })

        if (typeof value=="string"){
            if (!rfc2616){
                var rfc3339Matches = value.match(r0)
                if (!rfc3339Matches || rfc3339Matches.length < 3){
                    return ts.error(messageRegistry.INVALID_RFC3339,this);
                } else {
                    var date = rfc3339Matches[1];
                    var time = rfc3339Matches[2];
                    if (!checkDate(date) || !checkTime(time)) {
                        return ts.error(messageRegistry.INVALID_RFC3339,this);
                    }
                }
                return ts.ok();
            }
            else{
                if (!(value.match(r1)||value.match(r2)||value.match(r3))){
                    return ts.error(messageRegistry.INVALID_RFC2616,this);
                }
            }
            return ts.ok();
        }
        return ts.error(messageRegistry.INVALID_DATTIME,this);
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

function checkDateString(dateStr : string, dateFormat:string):boolean {
    if(!date.isValid(dateStr,dateFormat)){
        return false;
    }
    var d = date.parse(dateStr,dateFormat,false);
    var ds = date.format(d,dateFormat,false);
    return ds.trim() == dateStr.trim();
}