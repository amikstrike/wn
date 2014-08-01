// Подключаем модуль и ставим на прослушивание 8080-порта
var io = require('socket.io').listen(8080);
var fs = require('fs');
var xml2js = require('xml2js');
// Отключаем вывод полного лога
io.set('log level', 1);

//обьявляем переменные
var units = [];//массив юнитов
var items = [];//массив обьектов
var effects = [];//массив эффектов
var skills = [];//массив скилов
var all_objects = [];//массив всех отрисовуемых обьектов (текущих)
var users = 0;//кол-во игроков
var item;
var effect;
var effect_code = 0;
var skill_code = 0;
var score = {'blue': 0, 'red': 0};//счет
var win_score = 2;//макс колво убийтв для победы
var map_width;
var map_height;
var map_arr = [];//массив карты
var unit_arr = [];
var images = [];//картинки
var map = {
    img: '',
    red_spawn_x: 0,
    red_spawn_y: 0,
    blue_spawn_x: 0,
    blue_spawn_y: 0
};//атрибуты карты

var user_intervals = [];


var interval_send_data = 50;//интервал отправки данных
var unit_resurrection_time = 5000;//время возрождения

var action_code = {
    'stop': 0,
    'run': 1,
    'hit': 2,
    'block': 2,
    'dead': 3
};

var unit_direction = {//направление
    'right': 0,
    'left': 1,
    'up': 2,
    'down': 3,
    'right_up': 4,
    'right_down': 5,
    'left_up': 6,
    'left_down': 7
};

var arr_mouse_x = {//напр. мышки
    '1': 'right',
    '-1': 'left'
};

var arr_mouse_y = {//напр. мышки
    '1': 'up',
    '-1': 'down'
};

var direction_block = {//какая какое направление блочитд ругое направление
    0: 1,
    1: 0,
    2: 3,
    3: 2,
    4: 7,
    5: 6,
    6: 5,
    7: 4
};





//парсим xml файл, карта местности
var parser = new xml2js.Parser();
fs.readFile(__dirname + '/res/map.xml', function(err, data) {
    parser.parseString(data, function(err, result) {
        map_width = parseInt(result.map.width.toString());
        map_height = parseInt(result.map.height.toString());
        map.img = result.map.tile.toString();
        map.blue_spawn_x = parseInt(result.map.spawn[0].blue_spawn_x[0].toString());
        map.blue_spawn_y = parseInt(result.map.spawn[0].blue_spawn_y[0].toString());
        map.red_spawn_x = parseInt(result.map.spawn[0].red_spawn_x[0].toString());
        map.red_spawn_y = parseInt(result.map.spawn[0].red_spawn_y[0].toString());
        console.time('install_map');
        install_map();
        console.timeEnd('install_map');

        for (var i in result.map.items[0].item)
        {
            item = {
                'id': 'item_' + i,
                'type': result.map.items[0].item[i].type[0].toString(),
                'x': parseInt(result.map.items[0].item[i].x[0].toString()),
                'y': parseInt(result.map.items[0].item[i].y[0].toString()),
                'img': result.map.items[0].item[i].img[0].toString(),
                'img_id': '',
                'width': parseInt(result.map.items[0].item[i].width[0].toString()),
                'height': parseInt(result.map.items[0].item[i].height[0].toString()),
                'toll_x': parseInt(result.map.items[0].item[i].toll_x[0].toString()),
                'toll_y': parseInt(result.map.items[0].item[i].toll_y[0].toString())
            };
            if (!in_array(item.img, images)) {
                images.push(item.img);
            }
            items.push(item);
            all_objects.push(item);
            set_item_to_map(item);
        }

    });
});
//парсим файл юнита
var parser = new xml2js.Parser();
fs.readFile(__dirname + '/res/units.xml', function(err, data) {
    parser.parseString(data, function(err, result) {
        for (var i in result.units.unit)
        {
            unit_arr.push(result.units.unit[i]);
            images.push(unit_arr[i].img[0]);
        }
    });
});
//парсим эффекты
var parser = new xml2js.Parser();
fs.readFile(__dirname + '/res/effects.xml', function(err, data) {
    parser.parseString(data, function(err, result) {
        for (var i in result.effects.effect)
        {
            item = {
                'id': 'effect_' + i,
                'code': effect_code,
                'type': 'effect',
                'cover': result.effects.effect[i].cover[0].toString(),
                'x': 0,
                'y': 0,
                'damage': parseInt(result.effects.effect[i].damage[0].toString()),
                'img': result.effects.effect[i].img[0].toString(),
                'name': result.effects.effect[i].name[0].toString(),
                'animation': 0,
                'direction': 0,
                'img_id': '',
                'action_speed': parseInt(result.effects.effect[i].action_speed[0].toString()),
                'frames': parseInt(result.effects.effect[i].frames[0].toString()),
                'width': parseInt(result.effects.effect[i].width[0].toString()),
                'height': parseInt(result.effects.effect[i].height[0].toString())
            };
            if (!in_array(item.img, images)) {
                images.push(item.img);
            }
            effects.push(item);

        }

    });
});
//парсим скилы
var parser = new xml2js.Parser();
fs.readFile(__dirname + '/res/skills.xml', function(err, data) {
    parser.parseString(data, function(err, result) {
        for (var i in result.skills.skill)
        {
            item = {
                'id': 'skill_' + i,
                'code': skill_code,
                'type': 'skill',
                'x': 0,
                'y': 0,
                'damage': parseInt(result.skills.skill[i].damage[0].toString()),
                'speed': parseInt(result.skills.skill[i].speed[0].toString()),
                'effect': result.skills.skill[i].effect[0].toString(),
                'name': result.skills.skill[i].name[0].toString(),
                'animation': 0,
                'direction': 0
            };
            skill_code++;
            skills.push(item);
            //all_objects.push(item);
        }
    });
});


// Навешиваем обработчик на подключение нового клиента
io.sockets.on('connection', function(socket) {
    var ID = (socket.id).toString();
    var time = (new Date).toLocaleTimeString();
    users++;
    var unit;
    var msg_parameters;
    var action_interval;
    var packet_ready = false;
    var me_ready = false;
    // Посылаем клиенту сообщение о том, что он успешно подключился и его имя
    socket.json.send({'event': 'connected', 'name': ID, 'time': time});
    // Посылаем всем остальным пользователям, что подключился новый клиент и его имя
    socket.broadcast.json.send({'event': 'userJoined', 'name': ID, 'time': time});
    // Навешиваем обработчик на входящее сообщение
    socket.on('message', function(msg) {
        switch (msg.event)
        {
            case 'res_packet':
                if (me_ready) {
                    msg_parameters = msg;
                    packet_ready = true;
                }
                break;
            case 'del_user':
                del_user(msg.ID);
                break;
            case 'choosed_side':
                unit = {
                    'id': ID,
                    'x': map[msg.team + '_spawn_x'],
                    'y': map[msg.team + '_spawn_y'],
                    'img': unit_arr[msg.unit_type].img.toString(),
                    'img_id': '',
                    'screen_size': {'x': 0, 'y': 0},
                    'screen_delta': {'x': 0, 'y': 0},
                    'type': 'unit',
                    'team': msg.team,
                    'buffs': [],
                    'width': parseInt(unit_arr[msg.unit_type].width),
                    'height': parseInt(unit_arr[msg.unit_type].height),
                    'toll_x': parseInt(unit_arr[msg.unit_type].toll_x),
                    'toll_y': parseInt(unit_arr[msg.unit_type].toll_y),
                    'hit_length': parseInt(unit_arr[msg.unit_type].hit_length),
                    'name': unit_arr[msg.unit_type].name.toString(),
                    'damage': parseInt(unit_arr[msg.unit_type].damage.toString()),
                    'animation': 0,
                    'delayed': 0,
                    'live': true,
                    'action_speed': parseInt(unit_arr[msg.unit_type].action_speed.toString()),
                    'delay': 0,
                    'speed': parseInt(unit_arr[msg.unit_type].speed.toString()),
                    'max_speed': parseInt(unit_arr[msg.unit_type].speed.toString()),
                    'hp': parseInt(unit_arr[msg.unit_type].hp.toString()),
                    'tired': parseInt(unit_arr[msg.unit_type].tired.toString()),
                    'max_hp': parseInt(unit_arr[msg.unit_type].hp.toString()),
                    'max_tired': parseInt(unit_arr[msg.unit_type].tired.toString()),
                    'action': action_code['stop'], // 0 - stop, 1 - run
                    'direction': 0
                };
                units.push(unit);
                all_objects.push(unit);
                me_ready = true;
                //отсылаем сведения о карте
                socket.json.send({'event': 'first_packet', 'my_unit': unit, 'map': map, 'images': images});

                action_interval = setInterval(function() { //цикл обновления параметров типка
                    if (me_ready && packet_ready) {
                        set_atributes(unit, msg_parameters);//устанавливаем атрибуты текущего положения
                        under_buff(unit);
                        set_buffs(unit);
                        unit_action(msg_parameters.key_x, msg_parameters.key_y, msg_parameters.mouse_pos, msg_parameters.mouse_key, msg_parameters.action_key, unit);//обрабатываем присланное действие
                        animate_effects();
                    }
                }, unit.action_speed);
                user_intervals[ID] = action_interval;
                break;


            default: //если чат
                var time = (new Date).toLocaleTimeString();
                // Уведомляем клиента, что его сообщение успешно дошло до сервера
                socket.json.send({'event': 'messageSent', 'name': ID, 'text': msg, 'time': time});
                // Отсылаем сообщение остальным участникам чата
                socket.broadcast.json.send({'event': 'messageReceived', 'name': ID, 'text': msg, 'time': time});
                break;
                /**/
        }
    });
    // При отключении клиента - уведомляем остальных
    socket.on('disconnect', function() {

        if (me_ready && user_intervals[ID]!=='kicked')
        {
            var time = (new Date).toLocaleTimeString();
            io.sockets.json.send({'event': 'userSplit', 'name': ID, 'time': time}); /**/
            var cur_unit_id;

            clear_space(unit);
            clearInterval(action_interval);
            setTimeout(function() {
                clear_space(unit);
            }, unit.action_speed * 2);
            cur_unit_id = get_unit(ID);
            units.splice(cur_unit_id, 1);//удаляем игрока из массива игроков.

            cur_unit_id = get_object(ID);
            all_objects.splice(cur_unit_id, 1);//удаляем игрока из массива игроков.

        }

    });
    setInterval(function() {
        if (me_ready)
        {
            regular_res(unit);
            socket.json.send({'event': 'main_packet', 'units': all_objects, 'my_unit': unit, 'score': score});
        }
    }, interval_send_data);

});



//functions

function del_user(ID){
     var time = (new Date).toLocaleTimeString();
            io.sockets.json.send({'event': 'userKicked', 'name': ID, 'time': time}); /**/
            var cur_unit_id;
            
            var un_cer = get_unit_obj(ID);

            clear_space(un_cer);
            clearInterval(user_intervals[ID]);
            setTimeout(function() {
                clear_space(un_cer);
            }, un_cer.action_speed * 2);
            cur_unit_id = get_unit(ID);
            units.splice(cur_unit_id, 1);//удаляем игрока из массива игроков.

            cur_unit_id = get_object(ID);
            all_objects.splice(cur_unit_id, 1);//удаляем игрока из массива игроков.
            user_intervals[ID] = 'kicked';
}

function get_unit_obj(id){
    var curunit;
    for (var i in units)
    {
        curunit = units[i];
        if (curunit.id == id)
        {
            return curunit;
        }
    }
    return 0;
    
}

function regular_res(unit) {
    all_objects.sort(units_sort_by_y);
    //all_objects.sort(sort_effects);
}

function units_sort_by_y(unit_1, unit_2)//сортируем, для отрисовки сначала дальние потом ближние
{
    return (unit_1.y + unit_1.height) - (unit_2.y + unit_2.height);
}

function sort_effects(unit_1) {
    if (unit_1.type == "effect" && unit_1.cover == "true") {
        return 1;
    }
}


function unit_action(key_x, key_y, mouse_pos, mouse_key, action_key, unit) {
    if (unit.hp > 0)//проверка не убит ли юнит
    {
        if (action_key != '') {//проверяем, юзает ли игрок скилл

            //console.log(action_key);
            //console.log(mouse_pos.x_map+' '+mouse_pos.y_map);

            unit['action'] = action_code['dead'];
            if (unit['animation'] == 8)
            {
                //create_arrow(unit, mouse_pos);
            }
            set_unit_direction(unit, mouse_pos);//устанавливаем его направление
            unit_do_animation(unit);//производим анимацию




        } else
        if (mouse_key == '') {//проверяем, не совершает ли других действий игрок

            unit['action'] = action_code['run'];

            set_direction(unit, key_x, key_y);
            if (check_space(unit, key_x, key_y))
            {
                clear_space(unit); //очищаем область под юнитом
                set_unit_new_position(unit, key_x, key_y);//продвигаем юнита на его скорость вперед
                set_space(unit); //записываем ID юнита в область нахождения
            }

            unit_do_animation(unit);//выполняем анимацию для юнита

        } else {//игрок совершает действие мышкой (приоритетное!) 

            set_unit_direction(unit, mouse_pos);//устанавливаем его направление

            if (mouse_key === 'left') {
                unit['action'] = action_code['hit'];
                unit_do_animation_hit(unit, mouse_pos, key_x, key_y);//совешаем удар

            } else if (mouse_key === 'right') {
                unit['action'] = action_code['block'];
            }
        }
    } else { //юнит таки убит
        if (unit.live == true) //момент смерти юнита
        {
            unit['animation'] = 0;
            unit.live = false;
            unit['action'] = action_code['dead'];
            if (unit.team == 'blue')
            {
                score.red += 1;
            } else if (unit.team == 'red')
            {
                score.blue += 1;
            }
            check_win();
            clear_space(unit);
            unit_resurrect(unit);
        }
        if (unit['animation'] < 9)
        {
            unit['animation'] += 1;
        }
    }
}


function install_map() //установка карты
{
    for (var i = 0; i < map_width * map_height; i++)
    {
        map_arr[i] = '0';
    }
    console.log(map_arr.length + ' elements');
}

function check_space(unit, key_x, key_y) {
    //проверить какая кнопка приходит, и в соответствии с етим прибавить к текущей координате скорость.
    var go_move_x = 0;
    var go_move_y = 0;

    if (key_x != '' && key_y != '')
    {
        if (key_y == 'up') {
            go_move_y = -parseInt(unit['speed'] / 1.5);
        } else
        if (key_y == 'down') {
            go_move_y = parseInt(unit['speed'] / 1.5);
        }
        if (key_x == 'left') {
            go_move_x = -parseInt(unit['speed'] / 1.5);
        } else
        if (key_x == 'right') {
            go_move_x = parseInt(unit['speed'] / 1.5);
        }
    }
    else if (key_x != '')
    {
        if (key_x == 'left') {
            go_move_x = -unit['speed'];
        } else
        if (key_x == 'right') {
            go_move_x = unit['speed'];
        }
    }
    else if (key_y != '')
    {
        if (key_y == 'up') {
            go_move_y = -unit['speed'];
        } else
        if (key_y == 'down') {
            go_move_y = unit['speed'];
        }
    }
    if ((unit.x > map.blue_spawn_x - 50 && unit.x < map.blue_spawn_x + 150) && (unit.y > map.blue_spawn_y - 50 && unit.y < map.blue_spawn_y + 150))
    {
        return true;
    }
    if ((unit.x > map.red_spawn_x - 50 && unit.x < map.red_spawn_x + 150) && (unit.y > map.red_spawn_y - 50 && unit.y < map.red_spawn_y + 150))
    {
        return true;
    }
    for (i = unit.x + parseInt(unit.width - unit.toll_x) / 2 + go_move_x; i < unit.x + unit.width / 2 + unit.toll_x / 2 + go_move_x; i++)
    {
        for (j = unit.y + unit.height - unit.toll_y + go_move_y; j < unit.y + unit.height + go_move_y; j++)
        {
            if ((map_arr[ j * map_width + i] !== '0' && map_arr[j * map_width + i] !== unit.id) || i > map_width || i < 1)
            {
                return false;
            }
        }
    }
    return true;
}

function set_space(unit) {
    var start_pos_x = parseInt(unit.x + parseInt(unit.width - unit.toll_x) / 2);
    var end_pos_x = parseInt(unit.x + unit.width / 2 + unit.toll_x / 2);
    var start_pos_y = parseInt(unit.y + unit.height - unit.toll_y);
    var end_pos_y = parseInt(unit.y + unit.height);
    for (i = start_pos_x; i < end_pos_x; i++)
    {
        for (j = start_pos_y; j < end_pos_y; j++)
        {
            map_arr[j * map_width + i] = unit.id;
        }
    }
}

function clear_space(unit) {
    var start_pos_x = parseInt(unit.x + parseInt((unit.width) - unit.toll_x) / 2);
    var end_pos_x = parseInt(unit.x + unit.width / 2 + unit.toll_x / 2);
    var start_pos_y = parseInt(unit.y + unit.height - unit.toll_y);
    var end_pos_y = parseInt(unit.y + unit.height);

    for (i = start_pos_x; i < end_pos_x; i++)
    {
        for (j = start_pos_y; j < end_pos_y; j++)
        {
            map_arr[j * map_width + i] = '0';
        }
    }
}



function hit(unit, mouse_pos) { //удар и блок работает
    var start_point_x;
    var end_point_x;
    var start_point_y;
    var end_point_y;
    var effect_x;
    var effect_y;
    var curunit;
    if (mouse_pos.x == 1)
    {
        start_point_x = unit.x + unit.width / 2 + unit.toll_x / 2;
        end_point_x = start_point_x + unit.hit_length;
    }
    else if (mouse_pos.x == -1)
    {
        start_point_x = unit.x + unit.width / 2 - unit.toll_x / 2 - unit.hit_length;
        end_point_x = start_point_x + unit.hit_length;
    } else if (mouse_pos.x == 0)
    {
        start_point_x = unit.x + unit.width / 2 - unit.toll_x / 2;
        end_point_x = start_point_x + unit.toll_x;
    }
    if (mouse_pos.y == 1)
    {
        start_point_y = unit.y + unit.height - unit.toll_y - unit.hit_length;
        end_point_y = start_point_y + unit.hit_length;
    } else if (mouse_pos.y == -1)
    {
        start_point_y = unit.y + unit.height;
        end_point_y = start_point_y + unit.hit_length;
    } else if (mouse_pos.y == 0)
    {
        start_point_y = unit.y;
        end_point_y = start_point_y + unit.height;
    }
    start_point_x = parseInt(start_point_x);
    start_point_y = parseInt(start_point_y);
    end_point_x = parseInt(end_point_x);
    end_point_y = parseInt(end_point_y);
    effect_x = parseInt(start_point_x + end_point_x) / 2;
    effect_y = parseInt(start_point_y + end_point_y) / 2;

    use_effect('hit_effect', effect_x, effect_y, unit.direction);
    hit:
            for (i = start_point_x; i < end_point_x; i++)
    {
        for (j = start_point_y; j < end_point_y; j++)
        {
            if (map_arr[j * map_width + i] != '0' && map_arr[j * map_width + i] != unit.id)
            {
                curunit = units[get_unit(map_arr[j * map_width + i])];
                if (curunit.live == true && curunit.team != unit.team)
                {
                    if (curunit.action != action_code['block'])//если не блочим - бьем
                    {
                        effect_on_unit_x = curunit.x + unit.width / 2;
                        effect_on_unit_y = curunit.y + unit.height / 2;
                        use_effect('purifection', effect_on_unit_x, effect_on_unit_y, unit.direction);
                        curunit.hp = curunit.hp - unit.damage;
                        break hit;
                    } //если блочим - проверяем на направление блока
                    else if (direction_block[unit.direction] != curunit.direction)
                    {
                        curunit.hp = curunit.hp - unit.damage;
                        effect_on_unit_x = curunit.x + unit.width / 2;
                        effect_on_unit_y = curunit.y + unit.height / 2;
                        use_effect('purifection', effect_on_unit_x, effect_on_unit_y, unit.direction);
                        curunit.hp = curunit.hp - unit.damage;
                        break hit;
                    }
                }
            }
        }
    }
}

function set_direction(unit, key_x, key_y) {
    if (key_x != '' && key_y != '')
    {
        unit['direction'] = unit_direction[key_x + '_' + key_y];
    } else
    if (key_x != '')
    {
        unit['direction'] = unit_direction[key_x];
    } else
    if (key_y != '')
    {
        unit['direction'] = unit_direction[key_y];
    }
}

function get_unit(id) {
    var curunit;
    for (var i in units)
    {
        curunit = units[i];
        if (curunit.id == id)
        {
            return i;
        }
    }
    return 0;
}


function get_object(id) {
    var curunit;
    for (var i in all_objects)
    {
        curunit = all_objects[i];
        if (curunit.id == id)
        {
            return i;
        }
    }
    return 0;
}

function get_effect(code) {
    var effect;
    for (var i in all_objects)
    {
        effect = all_objects[i];
        if (effect.code == code)
        {
            return i;
        }
    }
    return 0;
}

function set_atributes(unit, msg) {
    unit.screen_size.x = msg.screen_size.x;
    unit.screen_size.y = msg.screen_size.y;
    update_screen_delta(unit);
}

function update_screen_delta(unit) { //центрируем юнита на карте
    if ((unit.x >= unit.screen_size.x / 2 - parseInt(unit.width / 2)) && (unit.x + unit.screen_size.x / 2 <= map_width)) {
        unit.screen_delta.x = unit.x - unit.screen_size.x / 2 + parseInt(unit.width / 2);
    } else if (unit.x < unit.screen_size.x / 2 - parseInt(unit.width / 2))
    {
        unit.screen_delta.x = 0;
    } else if (unit.x + unit.screen_size.x / 2 > map_width)
    {
        unit.screen_delta.x = map_width - unit.screen_size.x + unit.width / 2;
    }
    if ((unit.y >= unit.screen_size.y / 2 - parseInt(unit.height / 2) - 70) && (unit.y + unit.screen_size.y / 2 <= map_height)) {
        unit.screen_delta.y = unit.y - unit.screen_size.y / 2 + parseInt(unit.height / 2) + 70;
    } else if (unit.y < unit.screen_size.y / 2 - parseInt(unit.height / 2) - 70)
    {
        unit.screen_delta.y = 0;
    }
}

function in_array(value, array)
{
    for (var i = 0; i < array.length; i++)
    {
        if (array[i] == value)
            return true;
    }
    return false;
}

function set_item_to_map(item) {
    var start_pos_x = parseInt(item.x + item.width / 2 - item.toll_x / 2);
    var end_pos_x = parseInt(item.x + item.width / 2 + item.toll_x / 2);
    var start_pos_y = parseInt(item.y + item.height - item.toll_y);
    var end_pos_y = parseInt(item.y + item.height);
    for (i = start_pos_x; i < end_pos_x; i++)
    {
        for (j = start_pos_y; j < end_pos_y; j++)
        {
            map_arr[j * map_width + i] = 'item';
        }
    }
}

function set_images() {
    for (var i in units) {
        for (var src in images) {
            if (units[i].img == images[src].imo_path) {
                units[i].img_id = src;
            }
        }
    }
}

function unit_resurrect(unit) {
    setTimeout(function() {
        clear_space(unit);
        unit.live = true;
        unit['action'] = action_code['stay'];
        unit['hp'] = unit['max_hp'];
        unit['x'] = map[unit['team'] + '_spawn_x'];
        unit['y'] = map[unit['team'] + '_spawn_y'];

    }, unit_resurrection_time);

}

function check_win() {
    if (score.red >= win_score)
    {
        io.sockets.json.send({'event': 'battle_ends', 'reason': 'red_team_wins'});
        score = {'red': 0, 'blue': 0};
        for (var i in units)
        {
            var curunit = units[i];
            unit_resurrect(curunit);
        }
    }
    else if (score.blue >= win_score)
    {
        io.sockets.json.send({'event': 'battle_ends', 'reason': 'blue_team_wins'});
        score = {'red': 0, 'blue': 0};
        for (var i in units)
        {
            var curunit = units[i];
            unit_resurrect(curunit);
        }
    }
}

function under_buff(unit) {
    unit.speed = unit.max_speed;
    unit.delay = 0;
    unit.buffs = [];
}

function set_buffs(unit) {
    if (unit.action == action_code['run'])//бег
    {
        unit.buffs.push('run');
    } else if (unit.action == action_code['hit']) {
        unit.buffs.push('hit');
    } else if (unit.tired < unit.max_tired) {
        unit.buffs.push('restore');
    }

    if (unit.tired <= 1)//усталость
    {
        unit.buffs.push('tired');
    }

    for (var i in unit.buffs)
    {
        buffs_array[unit.buffs[i]](unit);
    }
}

var buffs_array = {
    'tired': function(unit) {
        unit.speed = parseInt(unit.max_speed / 2);
        unit.delay = 1;
    },
    'run': function(unit) {
        unit.tired = unit.tired - 1;
        if (unit.tired < 0)
        {
            unit.tired = 0;
        }
    },
    'hit': function(unit) {
        unit.tired = unit.tired - 2;
        if (unit.tired < 0)
        {
            unit.tired = 0;
        }
    },
    'restore': function(unit) {
        unit.tired = unit.tired + 5;
        if (unit.tired > unit.max_tired)
        {
            unit.tired = unit.max_tired;
        }
    }
};


function use_effect(effect, effect_x, effect_y, direction) {
    var efc;
    var effect_used;
    for (var i in effects) {
        if (effects[i].name == effect)
        {
            effect_used = clone(effects[i]);
        }
    }
    effect_used.code = effect_code;
    effect_used.direction = direction;
    effect_used.x = effect_x - effect_used.width / 2;
    effect_used.y = effect_y - effect_used.height / 2;
    effect_code++;
    all_objects.push(effect_used);

    setTimeout(function() {
        efc = get_effect(effect_used.code);
        all_objects.splice(efc, 1);//удаляем игрока из массива игроков.
    }, effect_used.frames * effect_used.action_speed / 2);
    //console.log(effect.frames*effect.action_speed);
}

function animate_effects() {
    for (var i in all_objects) {
        if (all_objects[i].type == 'effect')
        {
            if (all_objects[i]['animation'] < 9)
            {
                all_objects[i]['animation'] += 1;
            } else {
                all_objects[i]['animation'] = 0;
            }
        }

    }
}


function clone(obj) {
    if (obj == null || typeof (obj) != 'object')
        return obj;
    var temp = new obj.constructor();
    for (var key in obj)
        temp[key] = clone(obj[key]);
    return temp;
}

function unit_do_animation(unit) {
    if (unit.delay != 0)
    {
        if (unit.delay == unit.delayed)
        {
            unit.delayed = 0;
            if (unit['animation'] < 9)
            {
                unit['animation'] += 1;

            } else {
                unit['animation'] = 0;
            }
        } else {
            unit.delayed++;
        }
    } else {
        if (unit['animation'] < 9)
        {
            unit['animation'] += 1;
        } else {
            unit['animation'] = 0;
        }
    }
}


function unit_do_animation_hit(unit, mouse_pos, key_x, key_y) {
    if (unit.delay != 0)//если замедлен
    {
        if (unit.delay == unit.delayed)
        {
            unit.delayed = 0;
            if (unit['animation'] < 9)
            {
                unit['animation'] += 1;
            } else {
                unit['animation'] = 0;
                hit(unit, mouse_pos, key_x, key_y);
            }
        } else {
            unit.delayed++;
        }
    } else {
        if (unit['animation'] < 9)
        {
            unit['animation'] += 1;
        } else {
            unit['animation'] = 0;
            hit(unit, mouse_pos, key_x, key_y);
        }
    }
}

function set_unit_direction(unit, mouse_pos) {
    if (mouse_pos.x != '0' && mouse_pos.y != '0')
    {
        unit['direction'] = unit_direction[arr_mouse_x[mouse_pos.x] + '_' + arr_mouse_y[mouse_pos.y]];
    } else {
        if (mouse_pos.x == '1')
        {
            unit['direction'] = unit_direction['right'];
        }
        else if (mouse_pos.x == '-1')
        {
            unit['direction'] = unit_direction['left'];
        }

        if (mouse_pos.y == '1')
        {
            unit['direction'] = unit_direction['up'];
        }
        else if (mouse_pos.y == '-1')
        {
            unit['direction'] = unit_direction['down'];
        }
    }
}

function set_unit_new_position(unit, key_x, key_y) {
    if (key_x != '' && key_y != '')
    {
        if (key_y == 'up') {
            unit['y'] -= unit['speed'] / 1, 5;
        } else
        if (key_y == 'down') {
            unit['y'] += unit['speed'] / 1, 5;
        }
        if (key_x == 'left') {
            unit['x'] -= unit['speed'] / 1, 5;
        } else
        if (key_x == 'right') {
            unit['x'] += unit['speed'] / 1, 5;
        }
    }
    else if (key_x != '')
    {
        if (key_x == 'left') {
            unit['x'] -= unit['speed'];
        } else
        if (key_x == 'right') {
            unit['x'] += unit['speed'];
        }
    }
    else if (key_y != '')
    {
        if (key_y == 'up') {
            unit['y'] -= unit['speed'];
        } else
        if (key_y == 'down') {
            unit['y'] += unit['speed'];
        }
    }
    else {
        unit['action'] = action_code['stop'];
    }
}