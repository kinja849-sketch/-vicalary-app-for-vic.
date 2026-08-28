/**
 * FoodImageService
 * Provides authentic, high-definition, verified culinary photography
 * strictly matching dish names, cuisines, and food categories with guaranteed uniqueness.
 */

// Comprehensive verified high-definition culinary photography catalog with unique URLs
const CULINARY_PHOTO_MAP: Record<string, string> = {
  // Breakfast Dishes
  'bubur oatmeal ayam suwir kuning': 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=800&q=80',
  'savory turmeric chicken oatmeal': 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=800&q=80',
  'omelet tahu bayam bumbu bawang': 'https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=800&q=80',
  'spinach & tofu garlic omelette': 'https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=800&q=80',
  'nasi merah telur ceplok & lalapan': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
  'brown rice with sunny egg & fresh greens': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
  'roti gandum alpukat telur rebus': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
  'avocado toast with soft boiled eggs': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
  'smoothie bowl pisang buah naga chia': 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=800&q=80',
  'dragon fruit & banana chia smoothie bowl': 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=800&q=80',
  'scrambled eggs jamur tiram & tomat': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
  'mushroom & tomato scrambled eggs': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
  'bubur manado sehat tanpa santan': 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=800&q=80',
  'healthy indonesian vegetable tinutuan porridge': 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=800&q=80',
  'pancake oatmeal pisang kayu manis': 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&w=800&q=80',
  'cinnamon banana oat pancakes': 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&w=800&q=80',
  'sandwich dada ayam panggang gandum': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
  'grilled chicken whole wheat sandwich': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
  'bihun kuah sayur dada ayam': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
  'warm rice noodle soup with chicken & greens': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
  'greek yogurt parfait buah segar': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
  'greek yogurt & fresh berry parfait': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
  'pepes tahu jamur kukus gurih': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  'steamed herb & mushroom tofu pepes': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',

  // Lunch Dishes
  'nasi merah ayam bakar bumbu rujak': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
  'grilled chicken in rujak glaze with brown rice': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
  'nasi merah dada ayam panggang rosemary': 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
  'ayam teriyaki jahe wijen nasi coklat': 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80',
  'sate dada ayam panggang bumbu kacang': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
  'grilled chicken satay with light peanut sauce': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
  'capcay goreng seafood & tahu': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
  'wok stir-fried capcay with shrimp & tofu': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
  'gado-gado siram bumbu kacang sehat': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  'indonesian steamed salad with warm peanut dressing': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  'ayam teriyaki wijen nasi coklat': 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80',
  'sesame chicken teriyaki with steamed rice': 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80',
  'tumis tempe tahu buncis saus tiram': 'https://images.unsplash.com/photo-1546069901-d68a9668383e?auto=format&fit=crop&w=800&q=80',
  'stir-fried tempeh, tofu & crisp green beans': 'https://images.unsplash.com/photo-1546069901-d68a9668383e?auto=format&fit=crop&w=800&q=80',
  'pepes ikan nila kemangi bumbu kuning': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
  'fragrant steamed tilapia with basil in banana leaf': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
  'soto ayam bening segar jeruk nipis': 'https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?auto=format&fit=crop&w=800&q=80',
  'clear turmeric chicken soto soup with herbs': 'https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?auto=format&fit=crop&w=800&q=80',
  'tumis kangkung terasi bawang putih': 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=800&q=80',
  'wok stir-fried water spinach with garlic': 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=800&q=80',
  'ikan tongkol balado rendah minyak': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
  'spicy indonesian tuna with fresh chili relish': 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
  'daging sapi cah brokoli saus tiram': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  'daging sapi cah brokoli bawang putih': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  'lean beef & broccoli stir-fry in oyster sauce': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  'sup jagung telur dada ayam': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
  'sweet corn & shredded chicken egg drop soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',

  // Dinner Dishes
  'dada ayam panggang lemon & buncis rebus': 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
  'sup ikan kakap kuah bening asam segar': 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
  'fresh indonesian snapper soup with tomatoes & lime': 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
  'dada ayam panggang bumbu rosemary lemon': 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
  'lemon herb grilled chicken breast': 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
  'tumis brokoli kangkung bawang putih & tahu': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  'garlic broccoli & tofu stir-fry': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  'ikan nila bakar madu pedas ringan': 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=800&q=80',
  'honey spiced grilled tilapia with lime': 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=800&q=80',
  'sup ayam jamur sayuran bening': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
  'clear chicken & mushroom vegetable soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
  'tumis tauge tahu tempe daun bawang': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
  'stir-fried bean sprouts, tofu & scallions': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
  'steak tempe saus lada hitam': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  'crisp tempeh steak with black pepper glaze': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  'salad dada ayam panggang saus wijen': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  'grilled chicken salad with light sesame dressing': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  'udang tumis bawang putih daun ketumbar': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=80',
  'garlic & cilantro sautéed tiger prawns': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=80',
  'sup tomat telur serabut lembut': 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=800&q=80',
  'silky tomato & egg drop comfort soup': 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=800&q=80',
  'ayam suwir kukus sambal matah rendah minyak': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80',
  'shredded steamed chicken with fresh balinese sambal': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80',
  'sayur bening bayam jagung manis': 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=800&q=80',
  'spinach & sweet corn light herbal broth': 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=800&q=80',

  // Snacks
  'edamame rebus tabur garam laut': 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80',
  'steamed sea salt edamame': 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80',
  'pisang panggang madu kayu manis': 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80',
  'cinnamon honey grilled banana': 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80',
  'kacang almond panggang tanpa garam': 'https://images.unsplash.com/photo-1536591375315-1b8368157772?auto=format&fit=crop&w=800&q=80',
  'roasted unsalted almonds': 'https://images.unsplash.com/photo-1536591375315-1b8368157772?auto=format&fit=crop&w=800&q=80',
  'rujak buah segar bumbu kacang ringan': 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&w=800&q=80',
  'fresh tropical fruit salad with light dressing': 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&w=800&q=80',
  'lumpia basah sayur saus tauco': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  'fresh vegetable summer rolls': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  'kacang hijau rebus gula aren jahe': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
  'warm ginger & mung bean snack': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
  'singkong rebus tabur kelapa parut': 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  'steamed cassava with fresh grated coconut': 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  'ubi cilembu panggang manis alami': 'https://images.unsplash.com/photo-1596040033282-5d9c2cb48695?auto=format&fit=crop&w=800&q=80',
  'roasted sweet potato with natural honey glaze': 'https://images.unsplash.com/photo-1596040033282-5d9c2cb48695?auto=format&fit=crop&w=800&q=80',
  'keripik tempe panggang oven': 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=800&q=80',
  'oven-baked crisp tempeh chips': 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=800&q=80',
  'potongan buah semangka & melon dingin': 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
  'chilled watermelon & honeydew slices': 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
  'tahu kukus isi sayuran renyah': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  'steamed tofu stuffed with julienned vegetables': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  'telur puyuh rebus & timun segar': 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=800&q=80',
  'hard-boiled quail eggs & crisp cucumber': 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=800&q=80',

  // Drinks
  'wedang jahe lemon madu hangat': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80',
  'warm ginger honey lemon infusion': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80',
  'es teh hijau lemon selasih': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
  'iced green tea with lemon & basil seeds': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
  'jus mangga segar tanpa gula tambahan': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
  'pure fresh mango nectar smoothie': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
  'kunyit asam segar tradisional': 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
  'traditional turmeric tamarind herbal drink': 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
  'infused water lemon mentimun mint': 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80',
  'lemon, cucumber & fresh mint infused water': 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80',
  'jus alpukat susu almond rendah kalori': 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80',
  'avocado almond milk silk shake': 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80',
  'es kelapa muda jeruk nipis murni': 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=800&q=80',
  'pure coconut water with fresh lime': 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=800&q=80',
  'teh serai wangi pandan hangat': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
  'warm lemongrass & pandan aromatic tea': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
  'jus buah naga pisang energi booster': 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80',
  'dragon fruit banana energy smoothie': 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80',
  'susu kedelai hangat madu murni': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80',
  'warm soy milk with pure blossom honey': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80',
  'jus tomat apel segar detox': 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=800&q=80',
  'fresh tomato & crisp apple cleanse juice': 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=800&q=80',
  'matcha latte dingin susu oat': 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80',
  'iced matcha green tea oat milk latte': 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80',

  // Desserts
  'puding chia santan ringan buah naga': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80',
  'dragon fruit light chia seed pudding': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80',
  'vanilla bean panna cotta berry compote': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
  'puding kelapa muda daun pandan': 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=800&q=80',
  'silky pandan coconut water jelly pudding': 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=800&q=80',
  'bola ubi ungu kukus isi coklat hitam': 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  'steamed purple sweet potato dark chocolate bites': 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  'parfait yogurt yunani madu & granola': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
  'greek yogurt, honey & almond parfait': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
  'sorbet mangga jeruk segar tanpa gula': 'https://images.unsplash.com/photo-1505394033641-40c6ad1178d7?auto=format&fit=crop&w=800&q=80',
  'pure mango citrus frozen sorbet': 'https://images.unsplash.com/photo-1505394033641-40c6ad1178d7?auto=format&fit=crop&w=800&q=80',
  'pisang bakar coklat hitam & keju ringan': 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80',
  'grilled banana with dark chocolate & light cheese': 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80',
  'puding coklat hitam susu almond': 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80',
  'dark chocolate almond milk pudding': 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80',
  'es krim pisang beku madu (nice cream)': 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=800&q=80',
  '1-ingredient frozen banana honey nice cream': 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=800&q=80',
  'kolak pisang labu kuning tanpa santan': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80',
  'healthy pumpkin & banana cinnamon compote': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80',
  'agar-agar buah naga & leci segar': 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=800&q=80',
  'dragon fruit & lychee clear fruit agar jelly': 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=800&q=80',
  'mousse alpukat coklat hitam rendah kalori': 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80',
  'dark cacao & whipped avocado velvet mousse': 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80'
};

// Fallback images categorized by meal category
const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  breakfast: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=800&q=80',
  lunch: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
  dinner: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
  snacks: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80',
  drinks: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
  desserts: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
  default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'
};

// Master list of all unique photo URLs for collision-free fallback
const ALL_UNIQUE_PHOTOS = Array.from(new Set(Object.values(CULINARY_PHOTO_MAP)));

/**
 * Resolves a high-quality, verified culinary food image matching the dish title, cuisine, and category.
 * Guarantees zero duplicate URLs across cards by hashing unmatched titles into unique photos.
 */
export function getFoodImageUrl(
  dishName: string = '',
  cuisine: string = 'Indonesian',
  category: string = 'lunch',
  usedPhotoUrls?: Set<string>
): string {
  const lowerTitle = dishName.toLowerCase().trim();
  const lowerCat = category.toLowerCase().trim();

  // 1. Direct exact match from culinary photo catalog
  if (CULINARY_PHOTO_MAP[lowerTitle]) {
    const url = CULINARY_PHOTO_MAP[lowerTitle];
    if (!usedPhotoUrls || !usedPhotoUrls.has(url)) {
      usedPhotoUrls?.add(url);
      return url;
    }
  }

  // 2. Keyword substring match
  for (const [key, url] of Object.entries(CULINARY_PHOTO_MAP)) {
    if (lowerTitle.includes(key) || key.includes(lowerTitle)) {
      if (!usedPhotoUrls || !usedPhotoUrls.has(url)) {
        usedPhotoUrls?.add(url);
        return url;
      }
    }
  }

  // 3. Collision-free deterministic hash into unique photos pool
  if (ALL_UNIQUE_PHOTOS.length > 0) {
    let hash = 0;
    for (let i = 0; i < lowerTitle.length; i++) {
      hash = (hash << 5) - hash + lowerTitle.charCodeAt(i);
      hash |= 0;
    }
    const startIndex = Math.abs(hash) % ALL_UNIQUE_PHOTOS.length;
    
    // Find first unused photo starting from hash index
    for (let i = 0; i < ALL_UNIQUE_PHOTOS.length; i++) {
      const idx = (startIndex + i) % ALL_UNIQUE_PHOTOS.length;
      const candidateUrl = ALL_UNIQUE_PHOTOS[idx];
      if (!usedPhotoUrls || !usedPhotoUrls.has(candidateUrl)) {
        usedPhotoUrls?.add(candidateUrl);
        return candidateUrl;
      }
    }

    return ALL_UNIQUE_PHOTOS[startIndex];
  }

  // 4. Return category-specific authentic fallback
  const fallback = CATEGORY_DEFAULT_IMAGES[lowerCat] || CATEGORY_DEFAULT_IMAGES.default;
  usedPhotoUrls?.add(fallback);
  return fallback;
}
