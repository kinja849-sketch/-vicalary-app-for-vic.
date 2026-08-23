"use client"
import { Heart } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { toggleFavoriteRecipe, getFavoriteRecipes } from "@/lib/api/recipes";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function FavoriteButton({ recipeId, className = "" }: { recipeId: string | number, className?: string }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    const { data: favorites } = useQuery({
        queryKey: ['favorite-recipes', user?.id],
        queryFn: () => getFavoriteRecipes(user!.id),
        enabled: !!user?.id
    });

    const isFavorite = favorites?.some((f: any) => String(f.recipe_id) === String(recipeId));

    const mutation = useMutation({
        mutationFn: () => toggleFavoriteRecipe(user!.id, String(recipeId)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['favorite-recipes', user?.id] });
            toast.success(isFavorite ? "Removed from favorites" : "Added to favorites");
        },
        onError: () => toast.error("Failed to update favorites")
    });

    return (
        <button 
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!user) return toast.error("Please log in to favorite recipes");
                mutation.mutate();
            }}
            className={`z-10 size-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all active:scale-90 ${className}`}
        >
            <Heart 
                size={20} 
                className={`transition-colors ${isFavorite ? 'fill-vic-pink text-vic-pink' : 'text-white'}`} 
            />
        </button>
    );
}
