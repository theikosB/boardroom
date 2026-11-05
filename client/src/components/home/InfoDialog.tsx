import { dialogCopy, type ShelfDialog } from "@/components/home/shelfDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InfoDialogProps {
  dialog: ShelfDialog | null;
  onOpenChange: (open: boolean) => void;
}

export function InfoDialog({ dialog, onOpenChange }: InfoDialogProps) {
  const copy = dialog ? dialogCopy(dialog) : null;

  return (
    <Dialog open={dialog !== null} onOpenChange={onOpenChange}>
      <DialogContent className="text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl leading-snug">
            {copy?.title ?? "Boardroom"}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            {copy?.body ?? ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" className="h-11 w-full text-base sm:w-auto" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
