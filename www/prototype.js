function A() {
	this.a = "a";
}

function B() {
	this.b = "b";
}

function C() {
	this.c = "c";	
}

function D() {
	this.d = "d";
}

B.prototype = new A();
C.prototype = new B();
D.prototype = new C();


function testInheritance() {
	var a = new A();
	var b = new B();
	var c = new C();
	var d = new D();
	
	alert(a.a + " " + a.b + " " + a.c + " " + a.d);
	alert(b.a + " " + b.b + " " + b.c + " " + b.d);
	alert(c.a + " " + c.b + " " + c.c + " " + c.d);
	alert(d.a + " " + d.b + " " + d.c + " " + d.d);
}