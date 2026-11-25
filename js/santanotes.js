// Santa's letters (December event, design-v2 section 8): one a day, 1 to 31 December, each with
// one true Christmas tradition from somewhere in the world. Santa's present (advent.js) brings
// the day's letter, and the kid keeps it in Santa's letters book.

export const SANTA_NOTES = [
  { day: 1, place: "Germany", note: "Some German Christmas markets are older than 500 years! The Striezelmarkt in Dresden began in 1434. People still sip warm drinks there and buy wooden toys and gingerbread hearts." },
  { day: 2, place: "Philippines", note: "In the Philippines, homes hang a star lantern called a parol. In the city of San Fernando, people build giant lanterns as big as a house, with thousands of lights that dance to music." },
  { day: 3, place: "Ukraine", note: "In Ukraine, some trees wear spider-web ornaments. An old story says spiders covered a poor family's bare tree in webs one night, and in the morning sun the webs shone like silver." },
  { day: 4, place: "Netherlands", note: "In the weeks before 5 December, children in the Netherlands set a shoe by the fireplace with a carrot or some hay for Sinterklaas's horse. Next morning there's a treat in the shoe." },
  { day: 5, place: "Austria", note: "Tonight in Austria, people dressed as Krampus, St. Nicholas's shaggy, horned helper, parade through the streets ringing big bells. He looks grumpy, but it's all a show." },
  { day: 6, place: "Germany", note: "Today is St. Nicholas Day! Last night, children in Germany cleaned their boots and set them outside the door. This morning the boots were full of nuts, oranges and chocolate." },
  { day: 7, place: "Colombia", note: "Tonight is Little Candles Day in Colombia. Families put candles and paper lanterns on windowsills, balconies and sidewalks, until whole streets glow." },
  { day: 8, place: "Japan", note: "In Japan, lots of families eat fried chicken from KFC on Christmas Eve! It started with a clever ad in 1974, and now people order their bucket weeks ahead." },
  { day: 9, place: "Venezuela", note: "In Caracas, Venezuela, people roller-skate to early-morning church services in the days before Christmas. Some streets even close to cars so the skaters can roll safely." },
  { day: 10, place: "Norway", note: "Every year the city of Bergen in Norway builds a whole town out of gingerbread: houses, ships, trains and bridges. Children and schools bake many of the buildings themselves." },
  { day: 11, place: "Czech Republic", note: "In the Czech Republic, some families buy a live carp for Christmas Eve dinner and keep it swimming in the bathtub for a few days first. Some children give it a name!" },
  { day: 12, place: "Iceland", note: "Last night the first of Iceland's 13 Yule Lads came down from the mountains. One a night, they leave a small gift in shoes on the windowsill. Naughty children get a potato!" },
  { day: 13, place: "Sweden", note: "Today is St. Lucia's Day in Sweden. In the dark morning, a girl in a white dress wears a crown of candles and leads a singing parade, and everyone eats saffron buns." },
  { day: 14, place: "Catalonia, Spain", note: "In Catalonia, families keep a little log with a painted face called the Tió. Children feed it and keep it warm, and at Christmas they tap it with sticks and sing until it drops sweets." },
  { day: 15, place: "Australia", note: "In Australia, Christmas comes in summer! Many families eat lunch outside, head to the beach, and sometimes Santa turns up on a surfboard." },
  { day: 16, place: "Mexico", note: "Tonight in Mexico, Las Posadas begins: nine nights of walking from house to house with candles, singing and asking for shelter. Each night ends with a party and a piñata." },
  { day: 17, place: "Canada", note: "Letters to me in Canada go to the postal code H0H 0H0, and Canada Post helps me answer every one. That's well over a million letters a year!" },
  { day: 18, place: "India", note: "In India, many families light little clay oil lamps on roofs and walls at Christmas, and some decorate a mango or banana tree instead of a pine. Paper stars glow in windows." },
  { day: 19, place: "Greece", note: "In Greece, a country of sailors, many families decorate a little wooden boat with lights for Christmas, as well as a tree. Some towns light up a big boat in the main square." },
  { day: 20, place: "Denmark", note: "In Denmark, families leave a bowl of rice porridge out on Christmas Eve for the nisse, a little gnome with a red cap. Forget it, and he might play tricks on you!" },
  { day: 21, place: "Finland", note: "Today is the shortest day of the year. In Rovaniemi, Finland, right on the Arctic Circle, the sun peeks over the hills for only a couple of hours. Snow and starlight keep it bright." },
  { day: 22, place: "Poland", note: "On Christmas Eve in Poland, dinner can't start until someone spots the first star in the sky. Families also set one extra place at the table, in case a surprise guest knocks." },
  { day: 23, place: "Mexico", note: "Tonight is the Night of the Radishes in Oaxaca, Mexico! People carve giant radishes into animals, angels and whole little towns, and the best ones win prizes." },
  { day: 24, place: "United States", note: "In 1955 a newspaper ad printed a wrong phone number, and children calling me reached an air defense center in Colorado. The colonel played along, and NORAD still tracks my sleigh." },
  { day: 25, place: "Austria", note: "Merry Christmas! On Christmas Eve 1818, in a little church in Oberndorf, Austria, Silent Night was sung for the very first time, played on a guitar. Now it's sung all around the world." },
  { day: 26, place: "United Kingdom", note: "Today is Boxing Day in the UK, Canada and Australia. Long ago it was a day to give boxes of gifts to workers and people in need. Now it's for family, games and leftovers." },
  { day: 27, place: "Ethiopia", note: "In Ethiopia, Christmas comes on 7 January. It's called Genna, and many people dress in white for church, then play a hockey-like game that is also called genna." },
  { day: 28, place: "China", note: "In China, friends give each other shiny wrapped apples on Christmas Eve. Christmas Eve there is called Peaceful Night, and the word for peace sounds like the word for apple." },
  { day: 29, place: "Russia", note: "In Russia, Grandfather Frost brings gifts on New Year's Eve with his granddaughter, the Snow Maiden. He has a long blue or red coat and a magic staff." },
  { day: 30, place: "Spain", note: "Tomorrow night in Spain, people eat 12 grapes at midnight, one on each chime of the clock, for 12 lucky months. Eating them that fast is harder than it sounds!" },
  { day: 31, place: "Scotland", note: "Tonight is Hogmanay in Scotland! After midnight, the first visitor through the door is the 'first-footer'. They bring luck, often with coal and shortbread. Happy New Year!" },
];

/** The letter for a December day (1..31), or null. */
export const santaNote = (day) => SANTA_NOTES.find((n) => n.day === Number(day)) || null;
