import * as React from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  Search,
  Settings,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </div>
  );
}

export default function ComponentsShowcase() {
  const [progress, setProgress] = React.useState(33);

  return (
    <TooltipProvider>
      <Toaster theme="dark" position="bottom-right" richColors />

      <div className="grid gap-6">
        {/* Buttons */}
        <Block title="Button — variants">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </Block>

        <Block title="Button — sizes">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Settings">
            <Settings />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Search">
            <Search />
          </Button>
          <Button disabled>
            <Loader2 className="animate-spin" />
            Loading
          </Button>
        </Block>

        {/* Badges */}
        <Block title="Badge">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </Block>

        {/* Form fields */}
        <Block title="Inputs & form fields">
          <div className="grid w-full gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ds-name">Hero name</Label>
              <Input id="ds-name" placeholder="Spider-Man" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ds-aspect">Aspect</Label>
              <Select>
                <SelectTrigger id="ds-aspect">
                  <SelectValue placeholder="Pick an aspect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aggression">Aggression</SelectItem>
                  <SelectItem value="justice">Justice</SelectItem>
                  <SelectItem value="leadership">Leadership</SelectItem>
                  <SelectItem value="protection">Protection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ds-notes">Deck notes</Label>
              <Textarea id="ds-notes" placeholder="Strategy, mulligan plans, sideboard…" />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="ds-aerial" defaultChecked />
              <Label htmlFor="ds-aerial">Has aerial trait</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="ds-permanent" defaultChecked />
              <Label htmlFor="ds-permanent">Permanent upgrades only</Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ds-disabled">Disabled input</Label>
              <Input id="ds-disabled" placeholder="Read-only" disabled />
            </div>
          </div>
        </Block>

        {/* Card */}
        <Block title="Card">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Black Panther</CardTitle>
              <CardDescription>King of Wakanda • Leadership</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                A strong board-state hero whose alter-ego ability draws cards while T'Challa builds
                a wall of upgrades.
              </p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">Open deck</Button>
              <Button size="sm" variant="outline">
                Card list
              </Button>
            </CardFooter>
          </Card>
        </Block>

        {/* Tabs */}
        <Block title="Tabs">
          <Tabs defaultValue="deck" className="w-full max-w-md">
            <TabsList>
              <TabsTrigger value="deck">Deck</TabsTrigger>
              <TabsTrigger value="curve">Cost curve</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="deck" className="mt-3 text-sm text-muted-foreground">
              40 cards · Leadership · Black Panther
            </TabsContent>
            <TabsContent value="curve" className="mt-3 text-sm text-muted-foreground">
              0:4 · 1:9 · 2:11 · 3:8 · 4+:8
            </TabsContent>
            <TabsContent value="rules" className="mt-3 text-sm text-muted-foreground">
              Search rulings via the rules document RAG.
            </TabsContent>
          </Tabs>
        </Block>

        {/* Overlays */}
        <Block title="Overlays — Dialog · Popover · Tooltip · Dropdown">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save deck?</DialogTitle>
                <DialogDescription>
                  Your changes will be persisted to your account.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>
                    <Check />
                    Save
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent className="space-y-2">
              <p className="text-sm font-medium">Filter cards</p>
              <p className="text-xs text-muted-foreground">
                Tweak aspect, type, and cost. Shortcut: <kbd>F</kbd>.
              </p>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Help">
                <Sparkles />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tooltips render in dark theme</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Deck</DropdownMenuLabel>
              <DropdownMenuItem>
                <Check />
                Mark complete
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={() => toast.success('Deck saved', { description: '40 cards · Leadership' })}
          >
            Trigger toast
          </Button>
        </Block>

        {/* Misc */}
        <Block title="Avatar · Progress · Skeleton">
          <Avatar>
            <AvatarImage src="" alt="" />
            <AvatarFallback>
              <User />
            </AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>BP</AvatarFallback>
          </Avatar>

          <div className="flex w-full max-w-sm items-center gap-3">
            <Progress value={progress} className="flex-1" />
            <Button size="xs" variant="outline" onClick={() => setProgress((p) => (p + 17) % 100)}>
              Tick
            </Button>
          </div>

          <div className="flex w-full max-w-sm items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </Block>

        <Block title="Alert">
          <Alert className="w-full">
            <AlertCircle />
            <AlertTitle>Sync available</AlertTitle>
            <AlertDescription>
              MarvelCDB published a new pack. Run{' '}
              <code className="font-mono text-xs">pnpm db:sync</code> to update.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive" className="w-full">
            <AlertCircle />
            <AlertTitle>Deck invalid</AlertTitle>
            <AlertDescription>
              You have 39 cards. A standard deck must contain 40–50 cards.
            </AlertDescription>
          </Alert>
        </Block>

        <Block title="Separator · Scroll area">
          <div className="w-full max-w-md space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span>Aggression</span>
              <Separator orientation="vertical" className="h-4" />
              <span>Justice</span>
              <Separator orientation="vertical" className="h-4" />
              <span>Leadership</span>
              <Separator orientation="vertical" className="h-4" />
              <span>Protection</span>
            </div>
            <Separator />
            <ScrollArea className="h-32 w-full rounded-md border border-border/60 p-3">
              <ul className="space-y-1 text-sm">
                {Array.from({ length: 20 }, (_, i) => (
                  <li key={i}>Card slot #{i + 1}</li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        </Block>
      </div>
    </TooltipProvider>
  );
}
