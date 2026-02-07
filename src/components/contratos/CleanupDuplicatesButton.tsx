import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// IDs of duplicate contracts to delete (keeping only the most recent per lead)
const DUPLICATE_IDS = [
  '8a8b45db-9b5a-4ad1-ac11-c558cf21e4c6',
  '5b969337-5d5f-4c19-a564-f5536f95c64a',
  'f1baac88-bf38-4ccf-9e6a-622944af2a86',
  'c6a9f7b7-1418-4f89-9609-dd57eaa30a85',
  '97ffc5b3-3f64-4680-bedd-aa348d8ef4cb',
  'a37af623-dab1-440a-b7e6-de62d31dc4a6',
  '93c317d7-4068-4446-b193-74744121ab5b',
  '1c19dd75-c9dd-4599-a964-735674793801',
  'd8e6ef26-07b5-44d7-bc0a-5b0b943a405f',
  'dbb65c80-12e4-45e5-89d2-b5c2207ad7f8',
  '3af54a59-0031-4010-b5cb-d5dfc7545eef',
  '39ab4d74-8338-4d19-8622-7caae941dcae',
  '4dac7d5c-28dc-4e10-9352-852061f49c61',
  '2f406fe5-c7c7-4c1a-9539-721284740047',
  '6eae9086-b17c-469a-917d-5ac0afea8bff',
  'a8ac3b0b-67ef-499d-abeb-f65d2c9cbea4',
];

export function CleanupDuplicatesButton({ onComplete }: { onComplete?: () => void }) {
  const [cleaning, setCleaning] = useState(false);
  const { toast } = useToast();

  const handleCleanup = async () => {
    setCleaning(true);
    
    try {
      const { error } = await supabase
        .from('contract_reminders')
        .delete()
        .in('id', DUPLICATE_IDS);
      
      if (error) throw error;
      
      toast({
        title: 'Limpeza concluída! 🧹',
        description: `${DUPLICATE_IDS.length} contratos duplicados foram removidos.`,
      });
      
      onComplete?.();
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast({
        title: 'Erro na limpeza',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handleCleanup}
      disabled={cleaning}
      className="text-destructive hover:text-destructive"
    >
      {cleaning ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4 mr-2" />
      )}
      Limpar Duplicados ({DUPLICATE_IDS.length})
    </Button>
  );
}
