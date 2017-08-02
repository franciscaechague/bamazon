
//================================================== CONECT MYSQL ===============================================


var mysql = require('mysql');
var inquirer = require('inquirer');
var consoleTable = require('console.table');
var Table = require('cli-table');



var connection = mysql.createConnection({
    host     : 'localhost',
    port     : '8889',
    user     : 'root',
    password : 'root',
    database : 'bamazon',
    multipleStatements: true
});

connection.connect(function (err) {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }
    console.log('connected as id ' + connection.threadId);
});



//================================================== INQUIRER APP ===============================================


var shoppingCart = [];
var totalCost = 0;



connection.query('SELECT item_id, product_name, price, stock_quantity FROM products', function(err, result){
	if(err) console.log(err);

	var table = new Table({
		head: ['Item Id#', 'Product Name', 'Price', 'In Stock'],
		style: {
			head: ['blue'],
			compact: false,
			colAligns: ['center'],
		}
	});

  for(var i = 0; i < result.length; i++){
  table.push(
    [result[i].item_id, result[i].product_name, result[i].price, result[i].stock_quantity]
  );
}
console.log(table.toString());

});

userSelectsItem();

function userSelectsItem(){
  var items = [];
  connection.query('SELECT product_name FROM products', function(err, res){
    if (err) throw err;
    for (var i = 0; i < res.length; i++) {
      items.push(res[i].product_name);
    }

inquirer.prompt([
      {
      name: 'choices',
      type: 'checkbox',
      message: 'Which products would you like to add to your cart? Press the space key to choose each Product and press enter when you are finished.',
      choices: items
      }
    ]).then(function(user){
      if (user.choices.length === 0) {
        console.log('Oops you didn\'t select anything!');
        inquirer.prompt([
          {
          name: 'choice',
          type: 'list',
          message: 'Your cart is empty. Would you like to keep shopping or leave?',
          choices: ['Keep Shopping', 'Leave']
          }
        ]).then(function(user){
            if (user.choice === 'Keep Shopping') {
                userSelectsItem();
            } else {
              console.log('Ok! Thanks for looking!');
              connection.end();
            }
        });
      } else {
        howManyItems(user.choices);
      }
    });
  });
}


function howManyItems(itemNames){
  var item = itemNames.shift();
  var itemStock;
  var department;
  connection.query('SELECT stock_quantity, price, department_name FROM products WHERE ?', {
    product_name: item
  }, function(err, res){
    if(err) throw err;
    itemStock = res[0].stock_quantity;
    itemCost = res[0].price;
    department = res[0].department_name;
  });
  inquirer.prompt([
    {
    name: 'amount',
    type: 'text',
    message: 'How many ' + item + ' would you like to purchase?',
    validate: function(str){
        if (parseInt(str) <= itemStock) {
          return true;
        } else {
          console.log('\nOops! We only have ' + itemStock + ' of those in stock.');
          return false;
        }
      }
    }
  ]).then(function(user){
    var amount = user.amount;
    shoppingCart.push({
      item: item,
      amount: amount,
      itemCost: itemCost,
      itemStock: itemStock,
      department: department,
      total: itemCost * amount
    });

    if (itemNames.length != 0) {
      howManyItems(itemNames);
    } else {
      checkout();
    }
    });
}


function checkout(){

  if (shoppingCart.length != 0) {
    var grandTotal = 0;
    console.log('---------------------------------------------');
    console.log('Here is your cart. Are you ready to checkout?');
    for (var i = 0; i < shoppingCart.length; i++) {
      var item = shoppingCart[i].item;
      var amount = shoppingCart[i].amount;
      var cost = shoppingCart[i].itemCost.toFixed(2);
      var total = shoppingCart[i].total.toFixed(2);
      var itemCost = cost * amount;
      grandTotal += itemCost;
      console.log(amount + ' ' + item + ' ' + '$' + total);
    }
    console.log('Total: $' + grandTotal.toFixed(2));
    inquirer.prompt([
      {
        name: 'checkout',
        type: 'list',
        message: 'Ready to checkout?',
        choices: ['Checkout', 'Edit Cart']
      }
    ]).then(function(res){

        if (res.checkout === 'Checkout') {
            updateDB(grandTotal);
        } else {
          editCart();
        }
      });
  } else {
    inquirer.prompt([
      {
      name: 'choice',
      type: 'list',
      message: 'Your cart is empty. Would you like to keep shopping or leave?',
      choices: ['Keep Shopping', 'Leave']
      }
    ]).then(function(user){
        if (user.choice === 'Keep Shopping') {
            userSelectsItem();
        } else {
          console.log('Ok! Thanks for looking!');
          connection.end();
        }
    });

  }
}

function updateDB(grandTotal){
  var item = shoppingCart.shift();
  var itemName = item.item;
  var itemCost = item.itemCost;
  var userPurchase = item.amount;

  connection.query('SELECT stock_quantity from products WHERE ?', {
    product_name: itemName
  }, function(err, res){
    var currentStock = res[0].stock_quantity;
    connection.query('UPDATE products SET ? WHERE ?', [
    {
      stock_quantity: currentStock -= userPurchase
    },
    {
      product_name: itemName
    }], function(err){
      if(err) throw err;

      if (shoppingCart.length != 0) {
        updateDB(grandTotal);
      } else {

        grandTotal = grandTotal.toFixed(2);
        console.log('Thank you for your purchase!');
        console.log('Your total today was $' + grandTotal);
        connection.end();
      }
    });
  });
}


function editCart(){

  var items = [];
  for (var i = 0; i < shoppingCart.length; i++) {
    var item = shoppingCart[i].item;
    items.push(item);
  }

  inquirer.prompt([
    {
    name: 'choices',
    type: 'checkbox',
    message: 'Select the items you would like to edit.',
    choices: items
    }
  ]).then(function(user){
      if (user.choices.length === 0) {
        console.log('Oops! You didn\'t select anything to edit!');
        checkout();
      } else {

        var itemsToEdit = user.choices;
        editItem(itemsToEdit);
      }
  });
}


function editItem(itemsToEdit){

  if (itemsToEdit.length != 0) {
    var item = itemsToEdit.shift();
    inquirer.prompt([
      {
      name: 'choice',
      type: 'list',
      message: 'Would you like to remove ' + item + ' from your cart entirely or change the quantity?',
      choices: ['Remove From My Cart', 'Change Quanity']
      }
    ]).then(function(user){
        if (user.choice === 'Remove From My Cart') {
          for (var i = 0; i < shoppingCart.length; i++) {
            if (shoppingCart[i].item === item) {
              shoppingCart.splice(i, 1);
              console.log('Updated!');
            }
          }
          editItem(itemsToEdit);
        } else {
          inquirer.prompt([
            {
            name: 'amount',
            type: 'text',
            message: 'How many ' + item + ' would you like to purchase?',
            }
          ]).then(function(user){
            for (var i = 0; i < shoppingCart.length; i++) {
              if (shoppingCart[i].item === item) {
                shoppingCart[i].amount = user.amount;
                shoppingCart[i].total = shoppingCart[i].itemCost * user.amount;
                console.log('Updated!');
              }
            }
            editItem(itemsToEdit);
          });
        }
      });
  } else {
    checkout();
  }
}
