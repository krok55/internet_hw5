///////////////////////////////////////////////////////////////////////
//              CALCULATOR OBJECT DEFINITIONS                        //
///////////////////////////////////////////////////////////////////////
	
/*	
	Constructs a new calculator object.
	inputObj - a cache for the intput object in the DOM
	outputObj - a cache for the screen object in the DOM
*/
function Calculator(inputObj,outputObj) {

	/* Private Members */
	var screen = 0;
	var that = this;
	
	var updateScreen = function() {		
		that.output.innerHTML = screen.toString();
		that.clearInput();
	}
	
	/* Public Members */
	this.input = inputObj;
	this.output = outputObj;	
	
	
	/* Privilleged Methods */	
	this.add = function(a) {
		if(a === '' || a === undefined || a === null)
			a = 0;
		screen += parseInt(a);
		updateScreen();
	}
	
	this.substruct = function(a) {
		if(a === '' || a === undefined || a === null)
			a = 0;
		screen -= parseInt(a);
		updateScreen();
	}
	this.multiply = function(a) {
		if(a === '' || a === undefined || a === null)
			a = 0;
		screen *= parseInt(a);
		updateScreen();
	}
	
	this.divide = function(a) {
		if(a === '' || a === undefined || a === null)
			a = 0;
			
		if(a === 0)		
			alert("Cannot divide by zero!");
		else		
			screen /= parseInt(a);
		updateScreen();
	}
	
	this.clear = function() {
		screen = 0;
		updateScreen();
	}
					
}

/* Public Methods */
Calculator.prototype.clearInput = function() {
	this.input.value = '';
}

Calculator.prototype.addNumber = function(num) {
	this.input.value += num.toString();
}

Calculator.prototype.parseKey = function(e) {
	var parsed = ""	
	for(var i = 0, l = this.input.value.length; i < l; i++)				
		if(this.input.value.charCodeAt(i) >= '0'.charCodeAt(0) && this.input.value.charCodeAt(i) <= '9'.charCodeAt(0))
			parsed += this.input.value[i];
	this.input.value = parsed;	
}
