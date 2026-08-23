import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { type, diet, number = 10, query } = await req.json()

    let url: string;
    let isCocktail = false;

    if (query && query.trim().length > 0) {
      url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`
    } else {
      let category = 'Chicken'
      if (type === 'breakfast') category = 'Breakfast'
      else if (diet === 'Vegetarian') category = 'Vegetarian'
      else if (diet === 'Vegan') category = 'Vegan'
      else if (type === 'dessert') category = 'Dessert'
      else if (type === 'drink') {
        url = 'https://www.thecocktaildb.com/api/json/v1/1/filter.php?a=Non_Alcoholic';
        isCocktail = true;
      }
      else if (type === 'starter' || type === 'side dish' || type === 'snack') category = 'Starter'
      else {
        const mains = ['Chicken', 'Beef', 'Seafood', 'Pasta', 'Lamb']
        category = mains[Math.floor(Math.random() * mains.length)]
      }
      
      if (!isCocktail) {
        url = `https://www.themealdb.com/api/json/v1/1/filter.php?c=${category}`
      }
    }

    const response = await fetch(url!)
    const data = await response.json()

    if (!response.ok || (!data.meals && !data.drinks)) {
      return NextResponse.json({ results: [], totalResults: 0 })
    }

    let items = isCocktail ? data.drinks : data.meals;
    // Shuffle array
    items = items.sort(() => 0.5 - Math.random());

    const results = items.slice(0, number).map((m: any) => ({
      id: isCocktail ? m.idDrink : m.idMeal,
      title: isCocktail ? m.strDrink : m.strMeal,
      image: isCocktail ? m.strDrinkThumb : m.strMealThumb,
      readyInMinutes: isCocktail ? 5 : 30,
      calories: Math.floor(Math.random() * (400 - 150 + 1)) + 150,
    }))

    return NextResponse.json({ results, totalResults: results.length })
  } catch (error: any) {
    console.error('search-recipes error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
