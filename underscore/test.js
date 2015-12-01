var _ = require('./underscore');

var log = console.log;

var arr = [1, 2, 3, 4, 5, 6];
var arr1 = _.groupBy(arr, function (val) {
    return val % 2 === 0 ? true : false;
});
var arr2 = _.partition(arr, function (val) {
   return val % 2 === 0 ? true : false; 
});

log(arr1);
log(arr2);